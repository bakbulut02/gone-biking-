import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYmFrYnVsdXQwMiIsImEiOiJjbXAyZHB6Ym0wZTJuMnRvb3RqeWZsN2I0In0.SRCqsKYKAJFdTWmGCgLYWQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {

  // -----------------------------
  // MAP LAYER
  // -----------------------------
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  // -----------------------------
  // CREATE SVG (IMPORTANT FIX)
  // -----------------------------
  const container = map.getCanvasContainer();

  const svg = d3.select(container)
    .append('svg')
    .style('position', 'absolute')
    .style('width', '100%')
    .style('height', '100%')
    .style('pointer-events', 'none');

  // -----------------------------
  // LOAD STATIONS
  // -----------------------------
  const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const jsonData = await d3.json(jsonurl);
  let stations = jsonData.data.stations;

  // -----------------------------
  // LOAD TRIPS
  // -----------------------------
  const url = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
  const trips = await d3.csv(url);

  const departures = d3.rollup(
    trips,
    v => v.length,
    d => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    v => v.length,
    d => d.end_station_id
  );

  // -----------------------------
  // COMPUTE TRAFFIC
  // -----------------------------
  stations = stations.map((station) => {
    let id = station.short_name;

    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;

    return station;
  });

  // -----------------------------
  // SCALE (MUST COME AFTER TRAFFIC)
  // -----------------------------
  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

  // -----------------------------
  // DRAW CIRCLES (NOW EVERYTHING EXISTS)
  // -----------------------------
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .each(function (d) {
        // Add <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(
            `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
          );
      });

  // -----------------------------
  // UPDATE POSITIONS
  // -----------------------------
  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy);
  }

  updatePositions();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

});