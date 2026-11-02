// Interactive globe showing where I've done research.
// Adapted from an Observable notebook for a plain web page:
//   html`...`      -> d3 .append() / .html()
//   FileAttachment -> d3.json()
//   require()      -> <script> tags in research.html

const LAND_URL = "data/land-110m.json";

Promise.all([d3.json(LAND_URL), d3.json("data/places.json")])
  .then(([world, placeData]) => drawGlobe(world, placeData))
  .catch(() => {
    d3.select("#globe").text("The globe couldn't load. Check that you're viewing the site through a web server.");
  });

function drawGlobe(world, placeData) {
  // ----- data -----
  const land = topojson.feature(world, world.objects.land);
  const places = placeData.features;
  const route = ["Boston, MA", "Granada, Spain", "Barcelona, Spain", "San Sebastián, Spain", "Boston, MA", "Pittsburgh, PA"];
  const coords = name => places.find(p => p.properties.name === name).geometry.coordinates;
  const links = d3.pairs(route).map(([a, b]) => ({ source: coords(a), target: coords(b) }));

  // ----- sizes -----
  const width = 640;   // Observable's built-in `width` doesn't exist here
  const height = 600;
  const r = Math.min(width, height) / 2.5;
  const cx = width / 2;
  const cy = height / 2;

  const projection = d3.geoOrthographic()
    .translate([cx, cy])
    .clipAngle(90)
    .scale(r)
    .rotate([40, -30]);  // start centered over the Atlantic so the US and Spain are visible

  const path = d3.geoPath(projection).pointRadius(5);

  // ----- svg -----
  const svg = d3.select("#globe").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("fill", "none")
    .attr("role", "img")
    .attr("aria-label", "Interactive globe marking places where Janet has done research. Drag to rotate.")
    .style("max-width", `${width}px`)
    .style("height", "auto")
    .style("overflow", "visible")
    .style("touch-action", "none")   // lets you drag on phones without scrolling the page
    .style("cursor", "grab");

    svg.html(`
    <defs>
      <radialGradient id="ocean_fill" cx="75%" cy="25%">
        <stop offset="5%" style="stop-color: var(--surface)" />
        <stop offset="100%" style="stop-color: var(--grid)" />
      </radialGradient>
      <radialGradient id="globe_highlight" cx="75%" cy="25%">
        <stop offset="5%" style="stop-color: var(--surface); stop-opacity: 0.6" />
        <stop offset="100%" style="stop-color: var(--accent-pale); stop-opacity: 0.2" />
      </radialGradient>
      <radialGradient id="globe_shading" cx="55%" cy="45%">
        <stop offset="30%" style="stop-color: var(--surface); stop-opacity: 0" />
        <stop offset="100%" style="stop-color: var(--ink); stop-opacity: 0.25" />
      </radialGradient>
      <radialGradient id="drop_shadow" cx="50%" cy="50%">
        <stop offset="20%" style="stop-color: var(--ink); stop-opacity: 0.35" />
        <stop offset="100%" style="stop-color: var(--ink); stop-opacity: 0" />
      </radialGradient>
    </defs>
    <g pointer-events="none">
      <ellipse cx="${cx}" cy="${cy + r * 0.95}" rx="${r * 0.9}" ry="${r * 0.25}" fill="url(#drop_shadow)" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ocean_fill)" />
      <path id="feature" style="fill: #c9b29c" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#globe_highlight)" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#globe_shading)" />
    </g>
    <g id="arcs" style="stroke: var(--ink-soft)" stroke-opacity="0.25" stroke-width="3" />
    <g id="flyers" style="stroke: var(--accent)" stroke-width="2" />
    <g id="points" style="fill: var(--ink)" />
  `);


  svg.call(drag(projection).on("drag", render));

  const feature = svg.select("#feature").datum(land);
  const arc = svg.select("#arcs").selectAll("path").data(links).join("path");
  const flyer = svg.select("#flyers").selectAll("path").data(links).join("path");
  const point = svg.select("#points").selectAll("path").data(places).join("path");
  // ----- tooltip -----
  const container = d3.select("#globe").style("position", "relative");
  const tooltip = container.append("div")
    .attr("role", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface)")
    .style("color", "var(--ink)")
    .style("border", "2px solid var(--ink)")
    .style("border-radius", "var(--radius)")
    .style("padding", "0.5rem 0.75rem")
    .style("font-size", "0.9rem")
    .style("line-height", "1.4")
    .style("max-width", "240px")
    .style("opacity", 0);

  point
    .attr("stroke", "transparent")   // invisible outline makes the dots easier to hover
    .attr("stroke-width", 14)
    .style("cursor", "pointer")
    .on("pointerenter", (event, d) => {
      tooltip.html(`<strong>${d.properties.name}</strong><br>${d.properties.label}`)
        .style("opacity", 1);
    })
    .on("pointermove", event => {
      const [x, y] = d3.pointer(event, container.node());
      tooltip.style("left", `${x + 14}px`).style("top", `${y + 14}px`);
    })
    .on("pointerleave", () => tooltip.style("opacity", 0));
  render();

  function render() {
    tooltip.style("opacity", 0);
    feature.attr("d", path);
    point.attr("d", path);
    arc.attr("d", renderArc);
    flyer.attr("d", renderFlyer).attr("stroke-opacity", fadeArc);
  }

  function renderArc({ source, target }) {
    return path({ type: "LineString", coordinates: [source, target] });
  }

  function renderFlyer({ source, target }) {
    const interpolate = d3.geoInterpolate(source, target);
    return `M${d3.ticks(0, 1, 40).map(t => {
      const h = 1.5 * t * (1 - t);           // arc height follows a parabola
      const [x1, y1] = projection(interpolate(t));
      return [x1 + (x1 - cx) * h, y1 + (y1 - cy) * h];
    }).join("L")}`;
  }

  function fadeArc({ source, target }) {
    const center = projection.invert([cx, cy]);
    const d = Math.max(d3.geoDistance(source, center), d3.geoDistance(target, center));
    return Math.PI / 2 - d + 0.2;              // fade arcs as they rotate to the back
  }
}

// ----- drag to rotate (unchanged from the starter, except .container) -----
function drag(projection) {
  let v0, q0, r0, a0, l;

  function pointer(event, that) {
    const t = d3.pointers(event, that);
    if (t.length !== l) {
      l = t.length;
      if (l > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      dragstarted.apply(that, [event, that]);
    }
    if (l > 1) {
      const x = d3.mean(t, p => p[0]);
      const y = d3.mean(t, p => p[1]);
      const a = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      return [x, y, a];
    }
    return t[0];
  }

  function dragstarted({ x, y }) {
    v0 = versor.cartesian(projection.invert([x, y]));
    q0 = versor(r0 = projection.rotate());
  }

  function dragged(event) {
    const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
    const delta = versor.delta(v0, v1);
    let q1 = versor.multiply(q0, delta);

    const p = pointer(event, this);
    if (p[2]) {
      const d = (p[2] - a0) / 2;
      const s = -Math.sin(d);
      const c = Math.sign(Math.cos(d));
      q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1);
    }

    projection.rotate(versor.rotation(q1));
    if (delta[0] < 0.7) dragstarted.apply(this, [event, this]);
  }

  return d3.drag()
    .container(function () { return this; })  // measure drag inside the svg, so it works when the svg is resized
    .on("start.drag", dragstarted)
    .on("drag.drag", dragged);
}