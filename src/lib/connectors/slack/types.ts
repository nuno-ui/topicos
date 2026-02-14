export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  channel: string;
  channel_name?: string;
  thread_ts?: string;
  type: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_member: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    real_name?: string;
  };
}
