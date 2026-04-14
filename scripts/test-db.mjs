import db from './src/lib/db.js';

const projects = await db.project.findMany({
  where: { status: 'in_progress' }
});

console.log(`Found ${projects.length} in-progress projects:`);
projects.forEach(p => {
  console.log(`- ${p.name} (${p.progress}%)`);
});

process.exit(0);
