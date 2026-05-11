/** Types partagés CRC (prescripteurs cardiologue). */

export interface PrescripteurItem {
  id: string;
  prescripteur_id: string;
  name: string;
  email: string;
  status: 'pending' | 'active';
  invited_at: string;
  joined_at: string | null;
  ecg_this_month: number;
}
