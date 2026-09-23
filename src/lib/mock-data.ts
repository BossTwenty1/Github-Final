export type Gravesite = {
  id: string;
  name: string;
  dates: string;
  birthYear: number;
  deathYear: number;
  plot: string;
  plotLabel: string;
  section: string;
  row: string;
  burialDate: string;
  status: "Verified";
  tone: string;
};

export const gravesites: Gravesite[] = [
  {
    id: "eleanor-roosevelt",
    name: "Eleanor Roosevelt",
    dates: "1884 – 1962",
    birthYear: 1884,
    deathYear: 1962,
    plot: "A-42",
    plotLabel: "Plot A-42",
    section: "Section A",
    row: "Row 4",
    burialDate: "Nov 12, 1962",
    status: "Verified",
    tone: "result-media--stone",
  },
  {
    id: "franklin-roosevelt",
    name: "Franklin Roosevelt",
    dates: "1882 – 1945",
    birthYear: 1882,
    deathYear: 1945,
    plot: "B-18",
    plotLabel: "Plot B-18",
    section: "Section B",
    row: "Row 2",
    burialDate: "Apr 15, 1945",
    status: "Verified",
    tone: "result-media--lawn",
  },
  {
    id: "theodore-roosevelt",
    name: "Theodore Roosevelt",
    dates: "1858 – 1919",
    birthYear: 1858,
    deathYear: 1919,
    plot: "C-07",
    plotLabel: "Plot C-07",
    section: "Section C",
    row: "Row 1",
    burialDate: "Jan 8, 1919",
    status: "Verified",
    tone: "result-media--quiet",
  },
];

export function normalizeSearchValue(value = "") {
  return value.trim().toLowerCase();
}

export function filterGravesites({ query = "", section = "all", year = "any" } = {}) {
  const normalizedQuery = normalizeSearchValue(query);

  return gravesites.filter((record) => {
    const matchesQuery = !normalizedQuery || [record.name, record.plot, record.plotLabel].some((value) => normalizeSearchValue(value).includes(normalizedQuery));
    const matchesSection = section === "all" || !section || record.section === section;
    const matchesYear = year === "any" || !year || (year === "1800-1899" && record.deathYear < 1900) || (year === "1900-1999" && record.deathYear >= 1900 && record.deathYear < 2000);
    return matchesQuery && matchesSection && matchesYear;
  });
}

export function getGravesiteById(id: string) {
  return gravesites.find((record) => record.id === id);
}

export function getGravesiteByPlot(plot: string) {
  return gravesites.find((record) => record.plot === plot);
}
