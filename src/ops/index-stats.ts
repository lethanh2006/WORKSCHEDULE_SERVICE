import mongoose from 'mongoose';

const DEFAULT_COLLECTIONS = [
  'chats',
  'messages',
  'tasks',
  'workrequests',
  'schedulerequests',
] as const;

interface IndexStatsRow {
  name: string;
  key: Record<string, number>;
  accesses: {
    ops: { toString(): string };
    since: Date;
  };
}

type CollectionStats =
  | { name: string; missing: true }
  | {
      name: string;
      indexes: Array<{
        name: string;
        key: Record<string, number>;
        accesses: { ops: string; since: Date };
      }>;
    };

async function collectIndexStats(): Promise<void> {
  const uri = process.env.INDEX_STATS_MONGO_URL;
  if (!uri) {
    throw new Error(
      'INDEX_STATS_MONGO_URL is required; use a dedicated read-only monitoring credential with indexStats permission.',
    );
  }

  const requestedCollections = process.argv.slice(2);
  const collectionNames =
    requestedCollections.length > 0
      ? requestedCollections
      : [...DEFAULT_COLLECTIONS];
  const connection = await mongoose
    .createConnection(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 10_000,
    })
    .asPromise();

  try {
    const collections: CollectionStats[] = [];
    for (const collectionName of collectionNames) {
      const exists = await connection.db
        ?.listCollections({ name: collectionName }, { nameOnly: true })
        .hasNext();
      if (!exists) {
        collections.push({ name: collectionName, missing: true });
        continue;
      }

      const stats = (await connection.db
        ?.collection(collectionName)
        .aggregate([{ $indexStats: {} }])
        .toArray()) as IndexStatsRow[] | undefined;
      collections.push({
        name: collectionName,
        indexes: (stats ?? [])
          .map(({ name, key, accesses }) => ({
            name: String(name),
            key,
            accesses: {
              ops: accesses.ops.toString(),
              since: accesses.since,
            },
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      });
    }

    process.stdout.write(
      `${JSON.stringify({ capturedAt: new Date().toISOString(), collections }, null, 2)}\n`,
    );
  } finally {
    await connection.close();
  }
}

void collectIndexStats().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`index-stats failed: ${message}\n`);
  process.exitCode = 1;
});
