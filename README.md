# Cornell GeoData

The website for Cornell GeoData, a Cornell University student project team building
instruments and software for environmental research in the Finger Lakes.

[Visit cornellgeodata.com](https://cornellgeodata.com)

Explore the team's projects, research updates, members, and sponsorship program.
The Visualizations section includes Sensor Map, Weather Forecast, Sensor Charts,
and an interactive LiDAR survey of central Ithaca.

## Development

Requires Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Run `npm start` in a second terminal
to enable the local sensor API; Vite forwards `/api` requests to port 4173.

Weather maps load from the team's published weather feed.

## Production

```sh
npm run build
npm start
```

The build writes the site and LiDAR viewer to `dist/`. The Express server serves
these files and the sensor API on `PORT`, defaulting to 4173.

## Where things live

Page components stay together by feature:

| Work on | Start here |
| --- | --- |
| Home page and globe | [src/pages/home/](src/pages/home/) |
| Sponsorship page and alumni display | [src/pages/sponsors/](src/pages/sponsors/) |
| Sensor map, charts, and weather forecast | [src/pages/visualizations/](src/pages/visualizations/) |
| Member and blog pages | [MembersPage.tsx](src/pages/MembersPage.tsx), [PostsPage.tsx](src/pages/PostsPage.tsx) |
| Projects, posts, roster, and recruitment dates | [src/data/](src/data/) |
| Shared fonts, colors, and styles | [src/styles/](src/styles/) |
| Ithaca LiDAR viewer | [lidar/](lidar/) |
| Images, fonts, sponsorship packet, and LiDAR data | [public/](public/) |

In `visualizations/`, `VisualizationsPage.tsx` handles navigation and feeds,
`SensorCharts.tsx` renders charts, and `sensorData.ts` defines stations, parses
readings, and exports CSV. `src/data/visualizations.ts` controls the project list;
its preview images live in `public/visualizations/`.

The LiDAR viewer has its own npm workspace for its rendering dependencies and is
built with the main site. `server.mjs` serves production files and sensor APIs;
`compress.mjs` compresses the build output.

Run `npm run lint` and `npx tsc --noEmit` to check code changes.
