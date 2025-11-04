import fs from "fs";
import path from "path";

export const getShortestRoute = async (req, res) => {
  try {
    const { from, to } = req.body;
    console.log("🔍 [Controller] Received request - from:", from, "to:", to);

    if (!from || !to) {
      console.log("❌ [Controller] Missing from or to");
      return res.status(400).json({ error: "Both 'from' and 'to' stations are required." });
    }

    // Load data files
    const edgesPath = path.resolve("./data/edges.json");
    const stationsPath = path.resolve("./data/stations.json");
    
    console.log("📁 [Controller] Edges path:", edgesPath);
    console.log("📁 [Controller] Stations path:", stationsPath);
    console.log("📁 [Controller] Edges file exists:", fs.existsSync(edgesPath));
    console.log("📁 [Controller] Stations file exists:", fs.existsSync(stationsPath));

    const edges = JSON.parse(fs.readFileSync(edgesPath, "utf-8"));
    const stations = JSON.parse(fs.readFileSync(stationsPath, "utf-8"));
    
    console.log("✅ [Controller] Loaded", stations.length, "stations and", edges.length, "edges");

    // Check if both stations exist (case-insensitive)
    const fromStation = stations.find(
      s => s.name.toLowerCase() === from.toLowerCase()
    );
    const toStation = stations.find(
      s => s.name.toLowerCase() === to.toLowerCase()
    );

    console.log("🔍 [Controller] From station found:", !!fromStation, fromStation?.name, "ID:", fromStation?.stationId);
    console.log("🔍 [Controller] To station found:", !!toStation, toStation?.name, "ID:", toStation?.stationId);

    if (!fromStation || !toStation) {
      console.log("❌ [Controller] One or both stations not found");
      return res.status(404).json({ error: "One or both stations not found." });
    }

    // --- Build Graph ---
    const graph = {};
    for (const edge of edges) {
      if (!graph[edge.from]) graph[edge.from] = [];
      if (!graph[edge.to]) graph[edge.to] = [];
      graph[edge.from].push({ node: edge.to, distance: edge.distance });
      graph[edge.to].push({ node: edge.from, distance: edge.distance });
    }
    
    console.log("✅ [Controller] Graph built with", Object.keys(graph).length, "nodes");

    // --- Run Dijkstra's Algorithm using stationIds ---
    const result = dijkstra(graph, fromStation.stationId, toStation.stationId);
    
    // Convert stationIds back to station names
    const pathWithNames = result.path.map(id => {
      const station = stations.find(s => s.stationId === id);
      return station ? station.name : id;
    });

    if (!result) {
      console.log("❌ [Controller] No route found");
      return res.status(404).json({ error: "No route found between given stations." });
    }

    console.log("✅ [Controller] Route found:", pathWithNames);
    res.json({
      from: fromStation.name,
      to: toStation.name,
      path: pathWithNames,
      distance: result.distance,
    });

  } catch (error) {
    console.error("❌ [Controller] Error in getShortestRoute:", error.message);
    console.error("❌ [Controller] Stack trace:", error.stack);
    res.status(500).json({ error: "Internal server error: " + error.message });
  }
};

function dijkstra(graph, start, end) {
  const distances = {};
  const previous = {};
  const visited = new Set();

  // Initialize distances
  for (const node of Object.keys(graph)) {
    distances[node] = node === start ? 0 : Infinity;
  }

  while (visited.size < Object.keys(graph).length) {
    // Find unvisited node with minimum distance
    let current = null;
    let minDist = Infinity;
    
    for (const node of Object.keys(graph)) {
      if (!visited.has(node) && distances[node] < minDist) {
        current = node;
        minDist = distances[node];
      }
    }

    if (current === null || minDist === Infinity) break; // No more reachable nodes

    visited.add(current);

    // Update distances to neighbors
    for (const neighbor of graph[current] || []) {
      const alt = distances[current] + neighbor.distance;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = current;
      }
    }
  }

  // Check if end node is unreachable
  if (distances[end] === Infinity) {
    console.log("❌ [Dijkstra] End node unreachable. Distance:", distances[end]);
    return null;
  }

  // Reconstruct path
  console.log("🔍 [Dijkstra] Previous map:", previous);
  console.log("🔍 [Dijkstra] Start node:", start, "End node:", end);
  console.log("🔍 [Dijkstra] Distances:", distances);
  
  const path = [];
  let node = end;
  let steps = 0;
  while (node !== undefined && steps < 100) {
    path.unshift(node);
    console.log("🔍 [Dijkstra] Step", steps, "- Current node:", node, "Previous:", previous[node]);
    node = previous[node];
    steps++;
  }

  console.log("✅ [Dijkstra] Path found:", path, "Distance:", distances[end]);
  return { path, distance: distances[end] };
}




