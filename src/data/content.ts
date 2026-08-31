// blog + project posts live in posts.ts; privacy/terms prose lives in legal.ts.
import membersData from './members.json';

export interface Member {
  name: string;
  subteam: string; // which grid section the card appears in
  lead?: boolean; // team leads sit first in their subteam's grid
  role?: string; // org-wide role label (Leadership section), e.g. "Faculty Advisor"
  badge?: string; // subteam whose corner badge to show; defaults to subteam
  photo: string; // path under /public, e.g. '/members/jane-doe.webp' - empty string shows a placeholder
  email: string;
  major: string;
  linkedin?: string;
}

export interface Project {
  slug?: string; // links the project card to its post at #/posts/<slug>; omit for no link
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  photo?: string; // path under /public; omitted shows a placeholder block
  photo2?: string; // second image, shown side by side on the full-width card
  photoPosition?: string; // object-position focal point within the crop frame
  photoAspect?: string; // card image aspect ratio; defaults to 16/10
}

export const PROJECTS: Project[] = [
  {
    slug: '3d-printed-weather-stations',
    tag: 'Tech x Air',
    tagColor: '#c92556',
    title: '3D Printed Weather Stations',
    body: "Weather stations printed to UCAR's open-source 3DPAWS design: temperature, pressure, humidity, wind and rain for a fraction of commercial cost. Built this summer, deploying around Cayuga Lake this fall.",
    photo: '/projects/sensors.webp',
  },
  {
    slug: 'cayuga-lake-buoy',
    tag: 'Water',
    tagColor: '#2e6fc9',
    title: 'Cayuga Lake Buoy',
    body: "A decommissioned research buoy from Todd Cowen's hydraulics lab, being refitted with a commercial GMX-550 weather station, our homemade stations, and a suite of water sensors into one floating lake-monitoring platform.",
    photo: '/projects/sensors-lake.webp',
  },
  {
    slug: 'atmospheric-tethersonde',
    tag: 'Air',
    tagColor: '#6d9dcd',
    title: 'Atmospheric Tethersonde',
    body: 'An affordable, portable atmospheric profiler. We built it to get high-resolution observations of boundary-layer and lake-effect weather.',
    photo: '/projects/tethersonde.webp',
    photoAspect: '4/5',
    photoPosition: '57% 50%',
  },
  {
    slug: 'nisar-ground-truthing',
    tag: 'Rock',
    tagColor: '#c1703f',
    title: 'NISAR Ground-Truthing',
    body: "Five soil-moisture nodes at the Game Farm site check NASA's NISAR satellite against what's actually in the dirt.",
    photo: '/projects/nisar.webp',
    photoAspect: '4/5',
    photoPosition: '50% 40%',
  },
  {
    slug: 'lidar-hexapod',
    tag: 'Tech x CUPI Partnership',
    tagColor: '#c92556',
    title: 'LiDAR Hexapod',
    body: 'A LiDAR attachment for a six-legged robot, built jointly with Cornell Physical Intelligence. Paired with UAV LiDAR, it is our path to digital twins of the Finger Lakes.',
    photo: '/projects/hexapod.webp',
  },
  {
    tag: 'Coming soon',
    tagColor: '#c92556',
    title: 'Drone Photogrammetry',
    body: 'Coming soon: repeatable aerial surveys of Finger Lakes shorelines. Overlapping drone passes stitched into 3D scans, to make erosion measurable and give our sensor data terrain context.',
    photo: '/projects/drone.webp',
  },
];

export const PARTNERS = [
  'Duffield College of Engineering',
  'Dept. of Earth & Atmospheric Sciences',
  'Cornell Project Team Program',
];

export const SUBTEAM_COLORS: Record<string, string> = {
  Leadership: '#4fae7d',
  Air: '#6d9dcd',
  Water: '#2e6fc9',
  Rock: '#c1703f',
  Data: '#8b3fbf',
  Tech: '#c92556',
  Business: '#dcbe32',
};

// corner badges in public/badges/ - one per subteam
export const SUBTEAM_BADGES: Record<string, string> = {
  Air: '/badges/air.webp',
  Water: '/badges/water.webp',
  Rock: '/badges/rock.webp',
  Data: '/badges/data.webp',
  Tech: '/badges/tech.webp',
  Business: '/badges/business.webp',
};

export const SPONSOR_PACKET_PDF = '/sponsorship/packet.pdf';

// Mohs hardness ladder (quartz 7 < topaz 8 < ruby/corundum 9 < diamond 10)
export const TIERS = [
  { name: 'Quartz', color: '#6d9dcd', amount: '$500+', perks: ['Logo on our website', 'Decal on a soil-moisture node at the Game Farm site', 'Thank-you in the alumni newsletter'] },
  { name: 'Topaz', color: '#c1703f', amount: '$1,500+', perks: ['Everything in Quartz', 'Decal on a Cayuga Lake sensor station, photographed on deployment day', 'Team resume book', 'Social media feature from the field'] },
  { name: 'Ruby', color: '#c92556', amount: '$3,000+', perks: ['Everything in Topaz', 'Decal on the tethersonde, flown to 500 feet', 'Logo on team apparel', 'Job postings featured in the alumni newsletter', 'Info session or recruiting event with the team'] },
  { name: 'Diamond', color: '#8b3fbf', amount: '$5,000+', perks: ['Everything in Ruby', 'Decal on the LiDAR hexapod robot and the survey drone', 'A sensor site around the lake named after you', 'First invite to demo day'] },
];

export const ALUMNI: { place: string; logo?: string }[] = [
  { place: 'UIUC', logo: '/alumni/uiuc.webp' },
  { place: 'Chevron', logo: '/alumni/chevron.webp' },
  { place: 'Amazon', logo: '/alumni/amazon.webp' },
  { place: 'NOAA', logo: '/alumni/noaa.webp' },
  { place: 'NCAR', logo: '/alumni/ncar.webp' },
  { place: 'KPMG', logo: '/alumni/kpmg.webp' },
  { place: 'Ernst & Young', logo: '/alumni/ey.webp' },
  { place: 'NASA', logo: '/alumni/nasa.webp' },
  { place: 'Capital One', logo: '/alumni/capital-one.webp' },
  { place: 'MIT Lincoln Laboratory', logo: '/alumni/mit-ll.webp' },
  { place: 'WashU', logo: '/alumni/washu.webp' },
  { place: 'United Airlines', logo: '/alumni/united.webp' },
  { place: 'Coinbase', logo: '/alumni/coinbase.webp' },
  { place: 'UC Berkeley', logo: '/alumni/berkeley.webp' },
  { place: 'Northwestern', logo: '/alumni/northwestern.png' },
  { place: 'Liberty Mutual', logo: '/alumni/liberty-mutual.webp' },
  { place: 'SpaceX', logo: '/alumni/spacex.webp' },
  { place: 'Yale', logo: '/alumni/yale.webp' },
];

// members live in src/members.json - mass-edit there. Photos go in
// public/members/ and each entry's "photo" is its path, e.g. "/members/jane.webp".
// Clicking a photo flips the tile to a contact card (email + major).
export const MEMBERS: Member[] = membersData;

export const SUBTEAM_COUNT = new Set(MEMBERS.map((m) => m.subteam)).size - 1; // Leadership isn't a subteam
// unique by email (name as fallback) so people on two subteams aren't
// double-counted; the faculty advisor isn't a student member
export const MEMBER_COUNT = new Set(MEMBERS.filter((m) => m.role !== 'Faculty Advisor').map((m) => m.email || m.name)).size;
