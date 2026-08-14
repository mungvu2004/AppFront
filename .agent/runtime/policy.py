"""Guardrail policy engine for the agent harness.

Read by .agent/hooks/pre_tool_use.py. FAIL-CLOSED by design: anything that
cannot be parsed or validated results in a DENY verdict (the hook maps DENY
to exit code 2, which is the only blocking exit code for PreToolUse).

Analysis strategy (BLOCK 6):
  1. Token-level analysis via shlex (handles quoting, ';', '&&', '|', '&').
  2. Command-substitution contents ($( ) and backticks) are extracted and
     analyzed recursively.
  3. Raw-string regexes are only a *secondary* warning layer (SQL, fork bomb).
  4. Allowlist-first: known-safe binaries pass through neutrally; unknown
     binaries also pass through neutrally (Claude Code's own permission
     system remains the final authority); dangerous patterns are DENIED here.

This module is stdlib-only except for PyYAML (verified installed; JSON is
attempted first so a pre-compiled JSON config also works).
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import re
import shlex
from typing import Any


class PolicyError(Exception):
    """Configuration or schema problem. The hook treats this as DENY."""


class Verdict:
    """Plain class instead of a dataclass: keeps hook startup imports minimal."""

    __slots__ = ("deny", "reason")

    def __init__(self, deny: bool, reason: str = "") -> None:
        self.deny = deny
        self.reason = reason


def _tempdir() -> str:
    """tempfile.gettempdir() without importing tempfile (pulls in shutil)."""
    for var in ("TMPDIR", "TEMP", "TMP"):
        value = os.environ.get(var)
        if value and os.path.isdir(value):
            return value
    return "C:\\Windows\\Temp" if os.name == "nt" else "/tmp"


ALLOW = Verdict(False, "")

_CONFIG_CACHE: dict[str, Any] | None = None

# --- raw-string secondary layer -------------------------------------------

_IFS_RE = re.compile(r"\$\{?IFS\}?")
_SQL_DESTROY_RE = re.compile(
    r"\b(drop\s+(database|table|schema)|truncate\s+table)\b", re.IGNORECASE
)
_FORK_BOMB_RE = re.compile(r":\s*\(\s*\)\s*\{|:\|:&")
_BACKTICK_RE = re.compile(r"`([^`]*)`")
_SECRET_ECHO_RE = re.compile(
    r"\$\{?\w*(TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|BEARER)\w*\}?",
    re.IGNORECASE,
)
_DANGEROUS_EVAL_RE = re.compile(
    r"shutil\s*\.\s*rmtree|os\s*\.\s*(system|remove|rmdir|unlink|removedirs)"
    r"|subprocess|rimraf|fs\s*\.\s*(rm|rmdir|unlink|rmSync|rmdirSync|unlinkSync)"
    r"|child_process|Remove-Item|Format-Volume|__import__|base64",
    re.IGNORECASE,
)
_PS_REMOVE_RE = re.compile(r"\bremove-item\b|\bri\s|\brd\s", re.IGNORECASE)
_PS_IEX_RE = re.compile(r"\biex\b|\binvoke-expression\b", re.IGNORECASE)
_HOOK_BYPASS_RE = re.compile(r"disableAllHooks|--dangerously-skip-permissions")

_SEPARATORS = {";", "&&", "||", "&", "\n"}
_DOWNLOADERS = {"curl", "wget", "iwr", "invoke-webrequest", "fetch"}
_SHELLS = {
    "sh", "bash", "zsh", "dash", "ksh", "pwsh", "powershell",
    "iex", "invoke-expression", "python", "python3", "node", "perl", "ruby",
}
_INTERPRETERS = {"python", "python3", "py", "node", "perl", "ruby"}
_EVAL_FLAGS = {"-c", "-e", "--eval", "-command", "-enc", "-encodedcommand"}
# Binaries where an unresolved shell variable in the arguments is itself a
# red flag (variable-expansion evasion, e.g. `X=rf; rm -$X /`). `rm` has its
# own stricter check; dd/mkfs are blanket-denied.
_VAR_SENSITIVE_BINARIES = {"chmod", "chown"}
_ASSIGNMENT_RE = re.compile(r"^[A-Za-z_][A-Za-z_0-9]*=(.*)$", re.DOTALL)
_VAR_REF_RE = re.compile(r"\$\{?([A-Za-z_][A-Za-z_0-9]*)\}?")


# --- config ----------------------------------------------------------------

def project_root_from(hook_file: str) -> str:
    """Resolve the repo root from a file living at <root>/.agent/<dir>/<file>."""
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(hook_file)), "..", "..")
    )


def load_config(root: str) -> dict[str, Any]:
    """Load + validate HARNESS.yaml.

    Hot path: a compiled JSON cache keyed by the sha256 of the YAML source,
    so the (comparatively slow) yaml import only happens after config edits.
    The cached config is re-validated against the schema on every load; the
    cache can therefore go stale or missing but never bypass validation.
    """
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    path = os.path.join(root, ".agent", "HARNESS.yaml")
    cache_path = os.path.join(root, ".agent", "telemetry", "harness.compiled.json")
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        raise PolicyError(f"cannot read HARNESS.yaml: {exc}") from exc
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()

    cfg: Any = None
    try:
        with open(cache_path, encoding="utf-8") as fh:
            cached = json.load(fh)
        if cached.get("source_sha256") == digest and isinstance(
            cached.get("config"), dict
        ):
            cfg = cached["config"]
    except (OSError, json.JSONDecodeError, AttributeError):
        cfg = None  # cache miss/corruption is never fatal; fall back to YAML

    if cfg is None:
        try:
            cfg = json.loads(text)  # HARNESS.yaml may be JSON-compatible YAML
        except json.JSONDecodeError:
            try:
                import yaml  # deferred: slow import kept off the hot path
            except ImportError as exc:  # pragma: no cover
                raise PolicyError(
                    "PyYAML missing and HARNESS.yaml is not JSON"
                ) from exc
            try:
                cfg = yaml.safe_load(text)
            except yaml.YAMLError as exc:
                raise PolicyError(f"HARNESS.yaml parse error: {exc}") from exc
        if not isinstance(cfg, dict):
            raise PolicyError("HARNESS.yaml root must be a mapping")
        validate_config(cfg, root)
        _write_compiled_cache(cache_path, digest, cfg)
    else:
        validate_config(cfg, root)

    _CONFIG_CACHE = cfg
    return cfg


def _write_compiled_cache(cache_path: str, digest: str, cfg: dict[str, Any]) -> None:
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        tmp = cache_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"source_sha256": digest, "config": cfg}, fh)
        os.replace(tmp, cache_path)
    except OSError:
        # Best-effort optimization only; the YAML path stays authoritative.
        return


def _schema_errors(schema: dict[str, Any], value: Any, path: str) -> list[str]:
    """Subset JSON-Schema validator: type, required, properties, items, enum, minimum."""
    errors: list[str] = []
    expected = schema.get("type")
    type_map: dict[str, type | tuple[type, ...]] = {
        "object": dict,
        "array": list,
        "string": str,
        "integer": int,
        "number": (int, float),
        "boolean": bool,
    }
    if expected is not None:
        py_type = type_map.get(expected)
        if py_type is None:
            errors.append(f"{path}: unsupported schema type {expected!r}")
            return errors
        if not isinstance(value, py_type) or (
            expected in ("integer", "number") and isinstance(value, bool)
        ):
            errors.append(f"{path}: expected {expected}, got {type(value).__name__}")
            return errors
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in {schema['enum']!r}")
    if "minimum" in schema and isinstance(value, (int, float)):
        if value < schema["minimum"]:
            errors.append(f"{path}: {value!r} < minimum {schema['minimum']!r}")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required key {key!r}")
        for key, sub in schema.get("properties", {}).items():
            if key in value:
                errors.extend(_schema_errors(sub, value[key], f"{path}.{key}"))
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            errors.extend(_schema_errors(schema["items"], item, f"{path}[{i}]"))
    return errors


def validate_config(cfg: dict[str, Any], root: str) -> None:
    schema_path = os.path.join(root, ".agent", "schema", "harness.schema.json")
    try:
        with open(schema_path, encoding="utf-8") as fh:
            schema = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise PolicyError(f"cannot load harness.schema.json: {exc}") from exc
    errors = _schema_errors(schema, cfg, "$")
    if errors:
        raise PolicyError("HARNESS.yaml schema violations: " + "; ".join(errors))


# --- command analysis ------------------------------------------------------

_SUBST_MARK = "__SUBST__"


def _strip_substitutions(raw: str) -> tuple[str, list[str]]:
    """Replace every `...` and $(...) block with a marker token.

    Returns (sanitized_command, inner_commands). The inner commands are
    analyzed recursively; the marker lets the outer analysis detect a
    command whose NAME is produced by substitution ($(echo rm) -rf /).
    """
    inners: list[str] = []

    def backtick_repl(m: re.Match[str]) -> str:
        inners.append(m.group(1))
        return f" {_SUBST_MARK} "

    text = _BACKTICK_RE.sub(backtick_repl, raw)
    out: list[str] = []
    i = 0
    while i < len(text):
        if text.startswith("$(", i):
            depth = 1
            j = i + 2
            while j < len(text) and depth > 0:
                if text[j] == "(":
                    depth += 1
                elif text[j] == ")":
                    depth -= 1
                j += 1
            inners.append(text[i + 2 : j - 1] if depth == 0 else text[i + 2 :])
            out.append(f" {_SUBST_MARK} ")
            i = j
        else:
            out.append(text[i])
            i += 1
    return "".join(out), [s for s in inners if s.strip()]


def _tokenize(raw: str) -> list[str]:
    lex = shlex.shlex(raw, posix=True, punctuation_chars=";&|")
    lex.whitespace_split = True
    try:
        return list(lex)
    except ValueError as exc:
        raise PolicyError(f"unparseable command: {exc}") from exc


def _split_pipelines(tokens: list[str]) -> list[list[list[str]]]:
    """tokens -> list of pipelines; each pipeline is a list of segments."""
    pipelines: list[list[list[str]]] = []
    pipeline: list[list[str]] = []
    segment: list[str] = []
    for tok in tokens:
        if tok in _SEPARATORS:
            if segment:
                pipeline.append(segment)
                segment = []
            if pipeline:
                pipelines.append(pipeline)
                pipeline = []
        elif tok == "|":
            if segment:
                pipeline.append(segment)
                segment = []
        else:
            segment.append(tok)
    if segment:
        pipeline.append(segment)
    if pipeline:
        pipelines.append(pipeline)
    return pipelines


def _binary_of(segment: list[str]) -> tuple[str, list[str], dict[str, str]]:
    """Split leading VAR=value assignments; return (binary, args, assignments)."""
    assignments: dict[str, str] = {}
    i = 0
    while i < len(segment):
        m = _ASSIGNMENT_RE.match(segment[i])
        if m and "=" in segment[i] and not segment[i].startswith("-"):
            name = segment[i].split("=", 1)[0]
            assignments[name] = m.group(1)
            i += 1
        else:
            break
    if i >= len(segment):
        return "", [], assignments
    binary = os.path.basename(segment[i]).lower()
    if binary.endswith(".exe"):
        binary = binary[:-4]
    return binary, segment[i + 1 :], assignments


def _resolve_vars(arg: str, env: dict[str, str]) -> str:
    def sub(m: re.Match[str]) -> str:
        return env.get(m.group(1), m.group(0))

    return _VAR_REF_RE.sub(sub, arg)


def _is_rootish_target(target: str, root: str) -> bool:
    t = target.strip().rstrip("*").strip('"').strip("'")
    if t in ("/", "~", "~/", "$HOME", "${HOME}", "%USERPROFILE%", ""):
        return True
    if re.fullmatch(r"[A-Za-z]:[\\/]?", t):
        return True  # drive root like C:\
    if t.startswith(("~", "$HOME", "${HOME}")):
        return True
    # Absolute path outside both the workspace and the temp dir.
    if os.path.isabs(t) or re.match(r"^[A-Za-z]:[\\/]", t):
        real = os.path.normcase(os.path.realpath(t))
        for safe in (root, _tempdir()):
            safe_real = os.path.normcase(os.path.realpath(safe))
            if real == safe_real or real.startswith(safe_real + os.sep):
                return False
        return True
    return False


def _check_rm(args: list[str], env: dict[str, str], root: str) -> Verdict:
    flags: set[str] = set()
    targets: list[str] = []
    for original in args:
        arg = _resolve_vars(original, env)
        if "$" in arg or _SUBST_MARK in arg:
            return Verdict(True, f"rm with unresolved shell variable: {original!r}")
        if arg.startswith("--"):
            flags.add(arg[2:])
        elif arg.startswith("-") and len(arg) > 1:
            flags.update(arg[1:])
        else:
            targets.append(arg)
    recursive = bool({"r", "R", "recursive"} & flags)
    if recursive:
        for t in targets:
            if _is_rootish_target(t, root):
                return Verdict(True, f"recursive delete of protected target {t!r}")
    return ALLOW


def _check_git(args: list[str], cfg: dict[str, Any]) -> Verdict:
    resolved = list(args)
    for a in resolved:
        # A variable in flag position could smuggle --force (`git push --$F`).
        # Variables inside ordinary args (commit messages) stay legal.
        if a.startswith("-") and "$" in a:
            return Verdict(True, f"git flag with unresolved variable: {a!r}")
    non_flags = [a for a in resolved if not a.startswith("-")]
    sub = non_flags[0] if non_flags else ""
    protected = set(cfg["guardrail"]["protected_branches"])
    if sub == "push":
        forced = any(
            a in ("-f", "--force") or a.startswith("--force") for a in resolved
        )
        if forced:
            branch_args = set(non_flags[1:])
            names = {b.split(":")[-1] for b in branch_args}
            if names & protected:
                return Verdict(True, "force push to a protected branch")
            if len(non_flags) < 3:
                # No explicit refspec: cannot prove target branch is safe.
                return Verdict(True, "force push without explicit branch (fail-closed)")
    if sub == "commit" and any(a in ("-n", "--no-verify") for a in resolved):
        return Verdict(True, "git commit --no-verify bypasses the pre-commit gate")
    return ALLOW


def _check_interpreter(binary: str, args: list[str]) -> Verdict:
    for i, arg in enumerate(args):
        if arg.lower() in _EVAL_FLAGS:
            payload = " ".join(args[i + 1 :])
            if _DANGEROUS_EVAL_RE.search(payload):
                return Verdict(
                    True, f"{binary} inline payload uses a destructive API"
                )
    return ALLOW


def _check_secret_read(binary: str, args: list[str], cfg: dict[str, Any]) -> Verdict:
    readers = {"cat", "type", "head", "tail", "less", "more", "strings", "grep", "cut"}
    if binary not in readers:
        return ALLOW
    for arg in args:
        base = os.path.basename(arg.strip('"').strip("'"))
        for pattern in cfg["guardrail"]["secret_globs"]:
            if fnmatch.fnmatch(base, pattern):
                return Verdict(True, f"reading secret file {arg!r}")
    return ALLOW


def _check_segment(
    segment: list[str], env: dict[str, str], cfg: dict[str, Any], root: str
) -> Verdict:
    binary, args, assignments = _binary_of(segment)
    env.update(assignments)
    if not binary:
        return ALLOW  # pure assignment segment; values stay in env for later segments
    if _SUBST_MARK.lower() in binary:
        return Verdict(
            True, "command name produced by command substitution (fail-closed)"
        )
    if binary in ("rm", "rmdir", "shred"):
        return _check_rm(args, env, root)
    if binary == "git":
        return _check_git([_resolve_vars(a, env) for a in args], cfg)
    if binary in ("dd", "mkfs", "format", "fdisk", "shutdown", "reboot", "mkfs.ext4"):
        return Verdict(True, f"destructive system binary {binary!r}")
    if binary in ("env", "printenv") and not args:
        return Verdict(True, "dumping the full environment may leak secrets")
    if binary in ("echo", "printf") and any(_SECRET_ECHO_RE.search(a) for a in args):
        return Verdict(True, "echoing a secret-looking environment variable")
    if binary in _INTERPRETERS:
        verdict = _check_interpreter(binary, args)
        if verdict.deny:
            return verdict
    if binary in _VAR_SENSITIVE_BINARIES:
        for arg in args:
            if "$" in _resolve_vars(arg, env):
                return Verdict(
                    True, f"{binary} with unresolved shell variable: {arg!r}"
                )
    verdict = _check_secret_read(binary, args, cfg)
    if verdict.deny:
        return verdict
    return ALLOW


def _check_pipeline(pipeline: list[list[str]]) -> Verdict:
    binaries = []
    for segment in pipeline:
        binary, _, _ = _binary_of(segment)
        binaries.append(binary)
    for i, upstream in enumerate(binaries):
        if upstream in _DOWNLOADERS:
            for downstream in binaries[i + 1 :]:
                if downstream in _SHELLS:
                    return Verdict(
                        True,
                        f"piping {upstream!r} output into {downstream!r} "
                        "(remote code execution)",
                    )
    return ALLOW


def _raw_checks(raw: str) -> Verdict:
    if _IFS_RE.search(raw):
        return Verdict(True, "$IFS expansion is an obfuscation technique")
    if _SQL_DESTROY_RE.search(raw):
        return Verdict(True, "destructive SQL (DROP/TRUNCATE)")
    if _FORK_BOMB_RE.search(raw):
        return Verdict(True, "fork bomb pattern")
    if _HOOK_BYPASS_RE.search(raw):
        return Verdict(True, "attempt to disable hooks or skip permissions")
    return ALLOW


def evaluate_command(raw: str, cfg: dict[str, Any], root: str) -> Verdict:
    """Analyze a Bash tool command. Fail-closed: parse errors DENY."""
    if not raw or not raw.strip():
        return Verdict(True, "empty command")
    verdict = _raw_checks(raw)
    if verdict.deny:
        return verdict
    sanitized, inners = _strip_substitutions(raw)
    for inner in inners:
        verdict = evaluate_command(inner, cfg, root)
        if verdict.deny:
            return Verdict(True, f"in command substitution: {verdict.reason}")
    tokens = _tokenize(sanitized)  # raises PolicyError -> hook denies
    env: dict[str, str] = {}
    pipelines = _split_pipelines(tokens)
    for pipeline in pipelines:
        verdict = _check_pipeline(pipeline)
        if verdict.deny:
            return verdict
        for segment in pipeline:
            verdict = _check_segment(segment, env, cfg, root)
            if verdict.deny:
                return verdict
    return ALLOW


def evaluate_powershell(raw: str, cfg: dict[str, Any], root: str) -> Verdict:
    """PowerShell commands: raw-layer checks plus a best-effort token pass.

    PowerShell syntax is not POSIX; an unparseable-but-harmless command falls
    through to Claude Code's own permission prompt instead of a hard deny.
    """
    if not raw or not raw.strip():
        return Verdict(True, "empty command")
    verdict = _raw_checks(raw)
    if verdict.deny:
        return verdict
    if _PS_IEX_RE.search(raw) and re.search(
        r"downloadstring|net\.webclient|invoke-webrequest|iwr\b", raw, re.IGNORECASE
    ):
        return Verdict(True, "download-and-execute via Invoke-Expression")
    if _PS_REMOVE_RE.search(raw) and re.search(r"-recurse", raw, re.IGNORECASE):
        m = re.search(r"(?:remove-item|\bri|\brd)\s+([^\s|;]+)", raw, re.IGNORECASE)
        target = m.group(1) if m else "/"
        if _is_rootish_target(target, root):
            return Verdict(True, f"Remove-Item -Recurse on protected target {target!r}")
    try:
        tokens = _tokenize(raw)
    except PolicyError:
        return ALLOW  # fall through to the permission prompt
    env: dict[str, str] = {}
    for pipeline in _split_pipelines(tokens):
        verdict = _check_pipeline(pipeline)
        if verdict.deny:
            return verdict
        for segment in pipeline:
            verdict = _check_segment(segment, env, cfg, root)
            if verdict.deny:
                return verdict
    return ALLOW


# --- file-write analysis ---------------------------------------------------

def _normalize(path: str) -> str:
    return os.path.normcase(os.path.realpath(path))


def evaluate_file_write(path_str: str, cfg: dict[str, Any], root: str) -> Verdict:
    if not path_str or not str(path_str).strip():
        return Verdict(True, "missing file path")
    raw_path = str(path_str)
    absolute = (
        raw_path if os.path.isabs(raw_path) else os.path.join(root, raw_path)
    )
    real = _normalize(absolute)
    root_real = _normalize(root)
    temp_real = _normalize(_tempdir())
    if real == temp_real or real.startswith(temp_real + os.sep):
        return ALLOW
    if not (real == root_real or real.startswith(root_real + os.sep)):
        return Verdict(True, f"write outside the workspace: {raw_path!r}")
    rel = os.path.relpath(real, root_real).replace("\\", "/").lower()
    for protected in cfg["guardrail"]["protected_paths"]:
        p = protected.rstrip("/").replace("\\", "/").lower()
        if rel == p or rel.startswith(p + "/"):
            return Verdict(True, f"write to protected path {protected!r}")
    base = os.path.basename(rel)
    for pattern in cfg["guardrail"]["secret_globs"]:
        if fnmatch.fnmatch(base, pattern):
            return Verdict(True, f"write to secret file {base!r}")
    return ALLOW


# --- telemetry helpers -----------------------------------------------------

_MASK_RE = re.compile(
    r"(?i)\b(token|secret|password|passwd|api[_-]?key|bearer|credential)\b"
    r"(\s*[=:]\s*)(\S+)"
)


def mask_secrets(text: str) -> str:
    return _MASK_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}***", text)
