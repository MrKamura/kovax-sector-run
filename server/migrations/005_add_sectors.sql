-- Predefined 25 sectors (5 per level). Id format: L{level}-{index}.
CREATE TABLE IF NOT EXISTS sectors (
  id    VARCHAR(32) PRIMARY KEY,
  name  VARCHAR(120) NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sectors (id, name, level) VALUES
  ('L1-01', 'Aquila Haven', 1),
  ('L1-02', 'Vega Refuge', 1),
  ('L1-03', 'Orion Calm', 1),
  ('L1-04', 'Cygnus Ease', 1),
  ('L1-05', 'Lyra Rest', 1),
  ('L2-01', 'Draco Green', 2),
  ('L2-02', 'Perseus Norm', 2),
  ('L2-03', 'Auriga Meadow', 2),
  ('L2-04', 'Phoenix Grove', 2),
  ('L2-05', 'Helios Plain', 2),
  ('L3-01', 'Arcturus Challenge', 3),
  ('L3-02', 'Sirius Hazard', 3),
  ('L3-03', 'Altair Risk', 3),
  ('L3-04', 'Rigel Peril', 3),
  ('L3-05', 'Deneb Trial', 3),
  ('L4-01', 'Nexus Violet', 4),
  ('L4-02', 'Vertex Purple', 4),
  ('L4-03', 'Apex Epic', 4),
  ('L4-04', 'Summit Epic', 4),
  ('L4-05', 'Crown Epic', 4),
  ('L5-01', 'Omega Gold', 5),
  ('L5-02', 'Alpha Legend', 5),
  ('L5-03', 'Prime Titan', 5),
  ('L5-04', 'Sovereign Reign', 5),
  ('L5-05', 'Ultima Legend', 5)
ON CONFLICT (id) DO NOTHING;
