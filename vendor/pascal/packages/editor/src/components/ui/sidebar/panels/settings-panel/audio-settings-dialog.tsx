import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../components/ui/primitives/dialog'
import { Slider } from '../../../../../components/ui/slider'
import useAudio from '../../../../../store/use-audio'
import { primitivesAndSidebar as vi } from '../../../../../i18n/regions/primitivesAndSidebar'

export function AudioSettingsDialog() {
  const {
    masterVolume,
    sfxVolume,
    radioVolume,
    muted,
    setMasterVolume,
    setSfxVolume,
    setRadioVolume,
    toggleMute,
  } = useAudio()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {vi.audioSettingsDialog.title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{vi.audioSettingsDialog.title}</DialogTitle>
          <DialogDescription>{vi.audioSettingsDialog.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Master Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-sm">{vi.audioSettingsDialog.masterVolume}</label>
              <span className="text-muted-foreground text-sm">{vi.audioSettingsDialog.percent(masterVolume)}</span>
            </div>
            <Slider
              disabled={muted}
              max={100}
              onValueChange={(value) => value[0] !== undefined && setMasterVolume(value[0])}
              step={1}
              value={[masterVolume]}
            />
          </div>

          {/* Radio Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-sm">{vi.audioSettingsDialog.radioVolume}</label>
              <span className="text-muted-foreground text-sm">{vi.audioSettingsDialog.percent(radioVolume)}</span>
            </div>
            <Slider
              disabled={muted}
              max={100}
              onValueChange={(value) => value[0] !== undefined && setRadioVolume(value[0])}
              step={1}
              value={[radioVolume]}
            />
          </div>

          {/* SFX Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-sm">{vi.audioSettingsDialog.soundEffects}</label>
              <span className="text-muted-foreground text-sm">{vi.audioSettingsDialog.percent(sfxVolume)}</span>
            </div>
            <Slider
              disabled={muted}
              max={100}
              onValueChange={(value) => value[0] !== undefined && setSfxVolume(value[0])}
              step={1}
              value={[sfxVolume]}
            />
          </div>

          {/* Mute Toggle */}
          <div className="border-t pt-4">
            <Button
              className="w-full justify-start gap-2"
              onClick={toggleMute}
              variant={muted ? 'default' : 'outline'}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              {muted ? vi.audioSettingsDialog.unmuteAll : vi.audioSettingsDialog.muteAll}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
