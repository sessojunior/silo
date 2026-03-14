import { seedMonitoring } from "@/lib/db/seed";

export async function POST() {
  try {
    await seedMonitoring();
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Seed de monitoramento completo (Radares, Páginas, Links e Produtos)" 
    }), { status: 200 });
  } catch (error) {
    console.error("Erro no seed:", error);
    return new Response(JSON.stringify({ 
      error: "Falha ao processar seed", 
      details: error instanceof Error ? error.message : String(error) 
    }), { status: 500 });
  }
}
