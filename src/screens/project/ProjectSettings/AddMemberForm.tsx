/**
 * Ô email và nút "Thêm thành viên" của thẻ thành viên — chỉ dựng khi `canEdit`.
 *
 * Lỗi nằm dưới ô (`Input` tự nối `aria-describedby`). Nút khoá trong lúc đang gửi
 * và, sau một lần 429, cho tới hết thời gian chờ mà hook đếm.
 */

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import type { MembersTabProps } from './MembersTab';

export type AddMemberFormProps = Pick<
  MembersTabProps,
  'memberEmail' | 'memberError' | 'isAddingMember' | 'isAddMemberLocked' | 'setMemberEmail' | 'addMember'
>;

export function AddMemberForm(props: AddMemberFormProps) {
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        props.addMember();
      }}
    >
      <Input
        type="email"
        label="Email người cần thêm"
        value={props.memberEmail}
        onChange={(event) => props.setMemberEmail(event.target.value)}
        error={props.memberError}
        wrapperClassName="min-w-0 flex-1"
        disabled={props.isAddingMember}
      />
      <Button
        type="submit"
        variant="secondary"
        // Nhãn ô cao 28 px (20 + mb-2); nút cao đúng bằng khung ô (46/38 px) nên đỉnh và đáy
        // thẳng hàng ở mọi khổ. Không `items-end`: khi có câu lỗi dưới ô, nút sẽ tụt theo nó.
        className="mt-7 h-[46px] min-h-[46px] sm:h-[38px] sm:min-h-[38px]"
        loading={props.isAddingMember}
        disabled={props.isAddMemberLocked}
      >
        Thêm thành viên
      </Button>
    </form>
  );
}
