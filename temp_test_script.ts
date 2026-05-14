import { db, authUser } from './packages/db/src';
import { eq } from 'drizzle-orm';
import { sendAssistantMessage } from './apps/api/src/services/ai-assistant-thread-service';

async function main() {
  try {
    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, 'teste@inpe.br'),
    });

    if (!user) {
      console.error('User not found');
      return;
    }

    const result = await sendAssistantMessage(
      { id: user.id, name: user.name || 'Test User' },
      { content: 'Quais modelos estão com menor disponibilidade nos últimos 30 dias?' }
    );

    console.log(JSON.stringify({
      status: result.generation.status,
      scope: result.scope
    }, null, 2));

  } catch (error: any) {
    console.error(error.stack || error);
  }
}

main().catch(console.error);
