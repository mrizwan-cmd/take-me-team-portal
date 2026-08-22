CREATE TABLE IF NOT EXISTS portal_feature_state (
  workspace_id TEXT NOT NULL,
  area TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (workspace_id, area)
);

CREATE INDEX IF NOT EXISTS portal_feature_state_workspace_idx ON portal_feature_state(workspace_id);
