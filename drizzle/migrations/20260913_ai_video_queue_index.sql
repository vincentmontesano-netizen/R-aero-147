CREATE INDEX ai_video_pending_idx ON ai_video_jobs("checkedAt","createdAt",id) WHERE status='running';
