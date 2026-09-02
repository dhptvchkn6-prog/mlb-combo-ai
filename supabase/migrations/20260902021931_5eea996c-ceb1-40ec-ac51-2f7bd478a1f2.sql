CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id TEXT NOT NULL UNIQUE,
  market_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  selection_type TEXT NOT NULL,
  player_id TEXT,
  subject TEXT NOT NULL,
  opponent TEXT NOT NULL,
  market_type TEXT NOT NULL,
  market_label TEXT NOT NULL,
  line NUMERIC,
  american INTEGER NOT NULL,
  sportsbook TEXT NOT NULL,
  model_probability NUMERIC NOT NULL,
  implied_probability NUMERIC NOT NULL,
  edge NUMERIC NOT NULL,
  ev_per_100 NUMERIC NOT NULL,
  confidence INTEGER NOT NULL,
  risk TEXT NOT NULL,
  data_quality TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  result TEXT NOT NULL DEFAULT 'PENDING',
  actual_value NUMERIC,
  graded_at TIMESTAMP WITH TIME ZONE,
  profit_units NUMERIC
);

CREATE INDEX predictions_game_date_idx ON public.predictions (game_date DESC);
CREATE INDEX predictions_result_idx ON public.predictions (result);

GRANT SELECT ON public.predictions TO anon;
GRANT SELECT ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Predictions are publicly readable"
  ON public.predictions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE public.line_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  sportsbook TEXT NOT NULL,
  line NUMERIC,
  american INTEGER NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX line_snapshots_market_idx ON public.line_snapshots (market_id, captured_at DESC);

GRANT SELECT ON public.line_snapshots TO anon;
GRANT SELECT ON public.line_snapshots TO authenticated;
GRANT ALL ON public.line_snapshots TO service_role;

ALTER TABLE public.line_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Line snapshots are publicly readable"
  ON public.line_snapshots FOR SELECT
  TO anon, authenticated
  USING (true);