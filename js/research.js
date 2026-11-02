// Loads project data, builds the project buttons/panel, and draws the D3 chart.
d3.json("data/projects.json").then(data => {
  buildProjects(data.projects);
  drawChart(data);
}).catch(() => {
  document.getElementById("project-panel").textContent =
    "Project data didn't load. Open this site through a web server (GitHub Pages or `python -m http.server`), not by double-clicking the file.";
});

function buildProjects(projects) {
  const buttons = d3.select("#project-buttons");
  const panel = d3.select("#project-panel");

  function show(p) {
    buttons.selectAll("button").attr("aria-pressed", d => d.id === p.id);
    panel.html("");
    panel.append("h3").text(p.title);
    panel.append("p").attr("class", "project-meta")
      .text(p.where + (p.with ? " | with " + p.with : ""));
    panel.append("p").text(p.summary);
    panel.append("ul").selectAll("li").data(p.contributions)
      .join("li").text(d => d);
  }

  buttons.selectAll("button").data(projects).join("button")
    .attr("class", "btn btn-outline")
    .attr("type", "button")
    .text(d => d.short)
    .on("click", (event, d) => show(d));

  show(projects[0]);
}

function drawChart({ areas, projects }) {
  const margin = { top: 70, right: 20, bottom: 10, left: 150 };
  const cell = 90;
  const width = margin.left + areas.length * cell + margin.right;
  const height = margin.top + projects.length * 56 + margin.bottom;

  const x = d3.scaleBand().domain(areas).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(projects.map(p => p.short)).range([margin.top, height - margin.bottom]);

  const svg = d3.select("#area-chart").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("role", "img")
    .attr("aria-label", "Grid showing which research areas each project covers");

  // light grid lines
  svg.append("g").selectAll("line").data(projects).join("line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", d => y(d.short) + y.bandwidth() / 2)
    .attr("y2", d => y(d.short) + y.bandwidth() / 2)
    .attr("stroke", "#e3eaf1");

  // column labels (wrapped onto two lines)
  svg.append("g").selectAll("text").data(areas).join("text")
    .attr("x", d => x(d) + x.bandwidth() / 2)
    .attr("y", margin.top - 38)
    .attr("text-anchor", "middle")
    .attr("font-size", 12).attr("fill", "#4a5672")
    .each(function (d) {
      const words = d.split(" ");
      const mid = Math.ceil(words.length / 2);
      [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].forEach((line, i) =>
        d3.select(this).append("tspan").attr("x", x(d) + x.bandwidth() / 2).attr("dy", i ? 15 : 0).text(line));
    });

  // row labels
  svg.append("g").selectAll("text").data(projects).join("text")
    .attr("x", margin.left - 12)
    .attr("y", d => y(d.short) + y.bandwidth() / 2)
    .attr("dy", "0.35em").attr("text-anchor", "end")
    .attr("font-size", 14).attr("fill", "#1f2a44")
    .text(d => d.short);

  // one circle per project x area; filled if the project covers the area
  const cells = projects.flatMap(p => areas.map(a => ({ p: p.short, a, on: p.areas.includes(a) })));
  svg.append("g").selectAll("circle").data(cells).join("circle")
    .attr("cx", d => x(d.a) + x.bandwidth() / 2)
    .attr("cy", d => y(d.p) + y.bandwidth() / 2)
    .attr("r", d => d.on ? 11 : 4)
    .attr("fill", d => d.on ? "#2f7d6d" : "#c9d4de")
    .append("title").text(d => `${d.p}: ${d.on ? "" : "not "}${d.a.toLowerCase()}`);
}
