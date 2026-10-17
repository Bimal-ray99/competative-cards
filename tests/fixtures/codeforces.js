export const cfUserFixture = {
  info: {
    handle: 'bob',
    rating: 1850,
    maxRating: 1920,
    rank: 'candidate master',
    maxRank: 'candidate master',
  },
  ratingHistory: [
    {
      contestId: 100,
      contestName: 'Round 100',
      rank: 500,
      ratingUpdateTimeSeconds: 1_700_000_000,
      oldRating: 1500,
      newRating: 1600,
    },
    {
      contestId: 101,
      contestName: 'Round 101',
      rank: 400,
      ratingUpdateTimeSeconds: 1_700_100_000,
      oldRating: 1600,
      newRating: 1700,
    },
    {
      contestId: 102,
      contestName: 'Round 102',
      rank: 300,
      ratingUpdateTimeSeconds: 1_700_200_000,
      oldRating: 1700,
      newRating: 1850,
    },
  ],
};

export const cfSubmissionsFixture = [
  {
    id: 1,
    verdict: 'OK',
    creationTimeSeconds: 1_700_000_000,
    problem: { contestId: 100, index: 'A', name: 'Easy', rating: 800, tags: [] },
  },
  // Duplicate of same problem — must not inflate count.
  {
    id: 2,
    verdict: 'OK',
    creationTimeSeconds: 1_700_001_000,
    problem: { contestId: 100, index: 'A', name: 'Easy', rating: 800, tags: [] },
  },
  {
    id: 3,
    verdict: 'OK',
    creationTimeSeconds: 1_700_100_000,
    problem: { contestId: 100, index: 'B', name: 'Mid', rating: 1200, tags: [] },
  },
  // Wrong answer — must not count.
  {
    id: 4,
    verdict: 'WRONG_ANSWER',
    creationTimeSeconds: 1_700_200_000,
    problem: { contestId: 101, index: 'A', name: 'Other', rating: 900, tags: [] },
  },
  // Unrated problem — counts, bucket "unrated".
  {
    id: 5,
    verdict: 'OK',
    creationTimeSeconds: 1_700_300_000,
    problem: { contestId: 102, index: 'C', name: 'NoRating', tags: [] },
  },
];
