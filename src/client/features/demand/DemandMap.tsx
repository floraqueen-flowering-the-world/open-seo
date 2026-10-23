import {
  geoAzimuthalEqualArea,
  geoEqualEarth,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { sortBy } from "remeda";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldAtlas from "world-atlas/countries-110m.json";
import { COUNTRIES } from "./countries";
import { formatChange, formatCompact, formatInt } from "./format";

type MapCountry = {
  country: string;
  impressions: number;
  growth: number | null;
};

// GSC codes of the countries drawn in the Europe inset (Russia and Turkey stay
// on the world map).
const EUROPE = new Set([
  "alb",
  "and",
  "aut",
  "bel",
  "bgr",
  "bih",
  "blr",
  "che",
  "cyp",
  "cze",
  "deu",
  "dnk",
  "esp",
  "est",
  "fin",
  "fra",
  "gbr",
  "gib",
  "grc",
  "hrv",
  "hun",
  "irl",
  "isl",
  "ita",
  "lie",
  "ltu",
  "lux",
  "lva",
  "mco",
  "mda",
  "mkd",
  "mlt",
  "mne",
  "nld",
  "nor",
  "pol",
  "prt",
  "rou",
  "smr",
  "srb",
  "svk",
  "svn",
  "swe",
  "ukr",
  "vat",
  "xkk",
]);

// Diverging scale on change vs the previous 28 days: orange shrinking, grey
// flat (within ±3%), blue growing.
const BINS = [
  { max: -0.45, color: "#b34a12" },
  { max: -0.25, color: "#d9783a" },
  { max: -0.1, color: "#eeae84" },
  { max: -0.03, color: "#f6dccb" },
  { max: 0.03, color: "#d9dedd" },
  { max: 0.1, color: "#d3e5ec" },
  { max: 0.25, color: "#8dbbd0" },
  { max: 0.45, color: "#3f84a6" },
  { max: Infinity, color: "#1f5f80" },
] as const;
export const CHANGE_COLORS = BINS.map((b) => b.color);

function changeColor(growth: number | null) {
  if (growth === null) return BINS[BINS.length - 1].color;
  return BINS.find((b) => growth <= b.max)!.color;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- world-atlas ships the TopoJSON as untyped JSON
const topology = worldAtlas as unknown as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;
const land = (
  feature(topology, topology.objects.countries) as FeatureCollection<
    Geometry,
    { name: string }
  >
).features.filter((f) => f.id !== "010"); // Antarctica: no searches, only space

const WORLD = { width: 960, height: 470 };
const INSET = { width: 400, height: 440 };

const worldProjection = geoEqualEarth().fitExtent(
  [
    [8, 8],
    [WORLD.width - 8, WORLD.height - 8],
  ],
  { type: "Sphere" },
);

const europeBox: Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiPoint",
    coordinates: [
      [-10, 36],
      [28, 35],
      [-8, 60],
      [31, 60],
      [12, 70],
      [10, 35],
    ],
  },
};
const europeProjection = geoAzimuthalEqualArea()
  .rotate([-10, -52])
  .fitExtent(
    [
      [6, 6],
      [INSET.width - 6, INSET.height - 6],
    ],
    europeBox,
  )
  .clipExtent([
    [0, 0],
    [INSET.width, INSET.height],
  ]);

const WORLD_MAX_RADIUS = 34;
const INSET_MAX_RADIUS = 34;
const BUBBLE_FLOOR = 15_000;
const INSET_BUBBLE_FLOOR = 5_000;
const WORLD_LABEL_FLOOR = 70_000;
const INSET_LABEL_FLOOR = 30_000;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Placed = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  name: string;
  detail: string;
};

// Greedy: biggest bubbles first; each label tries right, left, above, below
// its bubble and is dropped if every spot overlaps a label already placed.
function placeLabels(
  bubbles: { name: string; detail: string; x: number; y: number; r: number }[],
  bounds: { width: number; height: number },
) {
  const taken: Box[] = [];
  const placed: Placed[] = [];
  const overlaps = (a: Box) =>
    a.x0 < 0 ||
    a.y0 < 0 ||
    a.x1 > bounds.width ||
    a.y1 > bounds.height ||
    taken.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);

  for (const b of bubbles) {
    const w = Math.max(b.name.length * 7, b.detail.length * 6.2);
    const h = 28;
    const options: (Box & {
      x: number;
      y: number;
      anchor: Placed["anchor"];
    })[] = [
      {
        x0: b.x + b.r + 4,
        y0: b.y - 13,
        x: b.x + b.r + 4,
        y: b.y - 2,
        anchor: "start" as const,
      },
      {
        x0: b.x - b.r - 4 - w,
        y0: b.y - 13,
        x: b.x - b.r - 4,
        y: b.y - 2,
        anchor: "end" as const,
      },
      {
        x0: b.x - w / 2,
        y0: b.y - b.r - 4 - h,
        x: b.x,
        y: b.y - b.r - 4 - h + 11,
        anchor: "middle" as const,
      },
      {
        x0: b.x - w / 2,
        y0: b.y + b.r + 4,
        x: b.x,
        y: b.y + b.r + 4 + 11,
        anchor: "middle" as const,
      },
    ].map((o) => ({ ...o, x1: o.x0 + w, y1: o.y0 + h }));
    const spot = options.find((o) => !overlaps(o));
    if (!spot) continue;
    taken.push(spot);
    placed.push({
      x: spot.x,
      y: spot.y,
      anchor: spot.anchor,
      name: b.name,
      detail: b.detail,
    });
  }
  return placed;
}

function MapSvg({
  countries,
  projection,
  bounds,
  maxRadius,
  maxImpressions,
  bubbleFloor,
  labelFloor,
  labelFilter,
  ariaLabel,
}: {
  countries: MapCountry[];
  projection: GeoProjection;
  bounds: { width: number; height: number };
  maxRadius: number;
  maxImpressions: number;
  bubbleFloor: number;
  labelFloor: number;
  labelFilter: (code: string) => boolean;
  ariaLabel: string;
}) {
  const path = geoPath(projection);
  const bubbles = countries
    .filter((c) => c.impressions >= bubbleFloor && COUNTRIES[c.country])
    .map((c) => {
      const [, name, lon, lat] = COUNTRIES[c.country];
      const point = projection([lon, lat]);
      return point
        ? {
            ...c,
            name,
            x: point[0],
            y: point[1],
            r: maxRadius * Math.sqrt(c.impressions / maxImpressions),
            detail: `${formatCompact(c.impressions)} · ${formatChange(c.growth)}`,
          }
        : null;
    })
    .filter((b) => b !== null)
    .filter(
      (b) =>
        b.x >= 0 && b.y >= 0 && b.x <= bounds.width && b.y <= bounds.height,
    );
  const ordered = sortBy(bubbles, [(b) => b.impressions, "desc"]);
  const labels = placeLabels(
    ordered.filter(
      (b) => b.impressions >= labelFloor && labelFilter(b.country),
    ),
    bounds,
  );

  return (
    <svg
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      role="img"
      aria-label={ariaLabel}
      className="block h-auto w-full"
    >
      {projection === worldProjection ? (
        <path
          d={path({ type: "Sphere" }) ?? undefined}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
      ) : null}
      <g className="fill-muted stroke-card" strokeWidth={0.7}>
        {land.map((f) => (
          <path
            key={String(f.id ?? f.properties.name)}
            d={path(f) ?? undefined}
          />
        ))}
      </g>
      <g className="stroke-card" strokeWidth={1.2}>
        {ordered.map((b) => (
          <circle
            key={b.country}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill={changeColor(b.growth)}
            fillOpacity={0.9}
          >
            <title>
              {`${b.name}: ${formatInt(b.impressions)} searches, ${formatChange(b.growth)} vs the previous 28 days`}
            </title>
          </circle>
        ))}
      </g>
      <g
        className="fill-foreground stroke-card"
        strokeWidth={3}
        paintOrder="stroke"
        strokeLinejoin="round"
        aria-hidden
      >
        {labels.map((l) => (
          <text key={l.name} x={l.x} y={l.y} textAnchor={l.anchor}>
            <tspan fontSize={12} fontWeight={600}>
              {l.name}
            </tspan>
            <tspan
              x={l.x}
              dy={14}
              fontSize={11}
              className="fill-muted-foreground"
            >
              {l.detail}
            </tspan>
          </text>
        ))}
      </g>
    </svg>
  );
}

export function WorldDemandMap({ countries }: { countries: MapCountry[] }) {
  const max = Math.max(1, ...countries.map((c) => c.impressions));
  return (
    <MapSvg
      countries={countries}
      projection={worldProjection}
      bounds={WORLD}
      maxRadius={WORLD_MAX_RADIUS}
      maxImpressions={max}
      bubbleFloor={BUBBLE_FLOOR}
      labelFloor={WORLD_LABEL_FLOOR}
      labelFilter={(code) => !EUROPE.has(code)}
      ariaLabel="World map: one bubble per country, sized by searches that showed one of our pages and coloured by change vs the previous 28 days."
    />
  );
}

/** Europe is scaled up so its bubbles read; returns the factor for the caption. */
export function europeScale(countries: MapCountry[]) {
  const max = Math.max(1, ...countries.map((c) => c.impressions));
  const maxEurope = Math.max(
    1,
    ...countries.filter((c) => EUROPE.has(c.country)).map((c) => c.impressions),
  );
  const worldRadius = WORLD_MAX_RADIUS * Math.sqrt(maxEurope / max);
  return { max, factor: INSET_MAX_RADIUS / worldRadius };
}

export function EuropeDemandMap({ countries }: { countries: MapCountry[] }) {
  const { max, factor } = europeScale(countries);
  return (
    <MapSvg
      countries={countries.filter((c) => EUROPE.has(c.country))}
      projection={europeProjection}
      bounds={INSET}
      maxRadius={WORLD_MAX_RADIUS * factor}
      maxImpressions={max}
      bubbleFloor={INSET_BUBBLE_FLOOR}
      labelFloor={INSET_LABEL_FLOOR}
      labelFilter={() => true}
      ariaLabel="Europe inset in Lambert azimuthal equal-area: bubbles sized by searches and coloured by change vs the previous 28 days."
    />
  );
}
