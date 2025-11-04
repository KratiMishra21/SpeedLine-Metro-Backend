export function findShortestPath(edges, start, end) {
  const graph = {};

  edges.forEach(({ from, to, distance }) => {
    if (!graph[from]) graph[from] = {};
    if (!graph[to]) graph[to] = {};
    graph[from][to] = distance;
    graph[to][from] = distance;
  });

  const distances = {};
  const visited = {};
  const previous = {};
  Object.keys(graph).forEach(node => (distances[node] = Infinity));
  distances[start] = 0;

  while (true) {
    const unvisited = Object.keys(distances)
      .filter(node => !visited[node])
      .sort((a, b) => distances[a] - distances[b]);
    const closest = unvisited[0];
    if (!closest || closest === end) break;
    visited[closest] = true;

    for (const neighbor in graph[closest]) {
      const newDist = distances[closest] + graph[closest][neighbor];
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        previous[neighbor] = closest;
      }
    }
  }

  const path = [];
  let current = end;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return { route: path, distance: distances[end] };
}
