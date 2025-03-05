<template>
  <NuxtLayout name="admin">
    <div class="flex w-full bg-white dark:bg-neutral-900">
      <!-- Side left -->
      <div class="flex flex-grow flex-col">
        <div
          class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
        >
          <!-- Graphs -->
          <div
            class="grid grid-cols-2 border-b border-b-neutral-200 dark:border-b-neutral-700"
          >
            <div
              class="flex flex-col border-r border-r-neutral-200 dark:border-r-neutral-700 px-8 py-6"
            >
              <h3 class="pb-2 text-lg font-medium">Incidentes por data</h3>
              <div class="w-full max-w-96 mx-auto -mb-10">
                <ColumnChart />
              </div>
            </div>
            <div class="flex flex-col px-8 py-6">
              <h3 class="pb-2 text-lg font-medium">Causas de problemas</h3>
              <div class="flex">
                <div class="w-full max-w-96 mx-auto">
                  <DonutChart />
                </div>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div
            class="flex flex-col border-b border-b-neutral-200 dark:border-b-neutral-700 px-8 py-6"
          >
            <div class="flex flex-col">
              <div class="flex gap-4">
                <div><span class="text-xl font-bold">32</span> produtos</div>
                <div>
                  <span class="text-xl font-bold">6</span> incidentes hoje
                </div>
              </div>
              <div class="relative">
                <div
                  class="my-2 flex h-2 w-full gap-0.5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-700 text-xs"
                >
                  <div class="w-[70%] rounded-full bg-[#15CDCD]"></div>
                  <div class="w-[17%] rounded-full bg-[#F4A540]"></div>
                  <div class="w-[4%] rounded-full bg-[#E47174]"></div>
                </div>
                <div class="flex items-center text-xs text-muted-foreground">
                  <div
                    class="flex flex-wrap gap-x-6 gap-y-1 text-neutral-600 dark:text-neutral-200"
                  >
                    <div class="flex items-center">
                      <div
                        class="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-[#15CDCD]"
                      ></div>
                      <div>
                        <span
                          >Em execução: <span class="font-bold">12</span></span
                        >
                      </div>
                    </div>
                    <div class="flex items-center">
                      <div
                        class="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F4A540]"
                      ></div>
                      <div>
                        <span
                          >Precisam de atenção:
                          <span class="font-bold">3</span></span
                        >
                      </div>
                    </div>
                    <div class="flex items-center">
                      <div
                        class="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E47174]"
                      ></div>
                      <div>
                        <span
                          >Com problemas: <span class="font-bold">1</span></span
                        >
                      </div>
                    </div>
                    <div class="flex items-center">
                      <div
                        class="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-100"
                      ></div>
                      <div>
                        <span
                          >Falta rodar: <span class="font-bold">2</span></span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Products & tasks -->
          <div class="flex flex-col px-8 py-6">
            <h3 class="pb-2 text-lg font-medium text-red-500">Não iniciado</h3>
            <div class="mt-2 flex flex-col">
              <!-- Product item -->
              <Product1 />
              <!-- Product item -->
              <Product2 />
            </div>
            <h3 class="pb-2 text-lg font-medium text-orange-500">Rodando</h3>
            <div class="mt-2 flex flex-col">
              <!-- Product item -->
              <Product3 />
            </div>
            <h3 class="pb-2 text-lg font-medium text-green-500">Finalizado</h3>
            <div class="mt-2 flex flex-col"></div>
          </div>
        </div>
      </div>

      <!-- Side right -->
      <div
        class="hidden w-[400px] flex-shrink-0 flex-col border-l border-l-neutral-200 dark:border-l-neutral-700 lg:flex"
      >
        <div
          class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
        >
          <div class="px-8 py-6">
            <!-- Resume text -->
            <div
              class="flex flex-col border-b border-b-neutral-200 dark:border-b-neutral-700 pb-6"
            >
              <h2 class="pb-4 text-xl font-medium">Resumo do dia</h2>
              <p class="text-sm">
                Hoje você tem
                <strong>20%</strong>
                mais problemas que o normal, você resolveu
                <strong>3 problemas</strong> em dois projetos, mas o foco está
                <strong>12%</strong>
                menor.
              </p>
            </div>

            <!-- Activity resume -->
            <div
              class="grid grid-cols-2 border-b border-b-neutral-200 dark:border-b-neutral-700 py-6"
            >
              <div>
                <h4 class="pb-2 text-sm font-medium">Processos rodando</h4>
                <div>
                  <span class="text-xl font-medium">6h 18min</span>
                </div>
              </div>
              <div>
                <h4 class="pb-2 text-sm font-medium">Produtos concluídos</h4>
                <div>
                  <span class="inline-flex items-center">
                    <CircleProgressBar
                      :value="79"
                      :max="100"
                      size="20"
                      strokeWidth="16px"
                      colorUnfilled="#77C3FA"
                      rounded
                      class="mr-1"
                    />
                    <span class="pr-3 text-xl font-medium"> 79% </span>
                    <span class="pt-0.5 text-sm text-neutral-400"
                      >17 de 23</span
                    >
                  </span>
                </div>
              </div>
            </div>

            <!-- Radial Progress -->
            <div
              class="grid w-full grid-cols-4 border-b border-b-neutral-200 dark:border-b-neutral-700"
            >
              <div
                class="flex flex-col items-center justify-center border-r border-r-neutral-200 dark:border-r-neutral-700 px-2 py-6"
              >
                <div>
                  <CircleProgressBar
                    :value="62"
                    :max="100"
                    size="60"
                    strokeWidth="12px"
                    colorUnfilled="#C39BF4"
                    rounded
                    class="mb-1"
                    ><span class="pt-0.5 text-sm font-bold leading-none"
                      >15%</span
                    ></CircleProgressBar
                  >
                </div>
                <div class="text-sm font-medium">Produtos</div>
              </div>
              <div
                class="flex flex-col items-center justify-center border-r border-r-neutral-200 dark:border-r-neutral-700 px-2 py-6"
              >
                <div>
                  <CircleProgressBar
                    :value="15"
                    :max="100"
                    size="60"
                    strokeWidth="12px"
                    colorUnfilled="#6EC9AF"
                    rounded
                    class="mb-1"
                    ><span class="pt-0.5 text-sm font-bold leading-none"
                      >15%</span
                    ></CircleProgressBar
                  >
                </div>
                <div class="text-sm font-medium">Processos</div>
              </div>
              <div
                class="flex flex-col items-center justify-center border-r border-r-neutral-200 dark:border-r-neutral-700 px-2 py-6"
              >
                <div>
                  <CircleProgressBar
                    :value="81"
                    :max="100"
                    size="60"
                    strokeWidth="12px"
                    colorUnfilled="#F69493"
                    rounded
                    class="mb-1"
                    ><span class="pt-0.5 text-sm font-bold leading-none"
                      >81%</span
                    ></CircleProgressBar
                  >
                </div>
                <div class="text-sm font-medium">Projetos</div>
              </div>
              <div class="flex flex-col items-center justify-center px-2 py-6">
                <div>
                  <CircleProgressBar
                    :value="12"
                    :max="100"
                    size="60"
                    strokeWidth="12px"
                    colorUnfilled="#BCBFBE"
                    rounded
                    class="mb-1"
                    ><span class="pt-0.5 text-sm font-bold leading-none"
                      >12%</span
                    ></CircleProgressBar
                  >
                </div>
                <div class="text-sm font-medium">Outros</div>
              </div>
            </div>

            <!-- Ongoing projects -->
            <div class="flex flex-col py-6">
              <h3 class="pb-2 text-lg font-medium">Projetos em andamento</h3>
              <div class="mt-4 flex flex-col gap-3">
                <!-- Project item -->
                <div class="flex w-full flex-row text-sm">
                  <div class="mr-2">
                    <button
                      type="button"
                      class="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                    >
                      <Icon class="size-4" name="lucide:folder-kanban" />
                    </button>
                  </div>
                  <div class="flex w-full flex-col">
                    <div class="font-medium py-0.5">Projeto 1</div>
                    <div class="flex items-center">
                      <div class="w-40 text-xs leading-none">
                        56% <span class="text-neutral-200">•</span> 14 dias
                      </div>
                      <!-- Progress -->
                      <div
                        class="flex w-full h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-neutral-700"
                        role="progressbar"
                        aria-valuenow="56"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div
                          class="w-[56%] flex flex-col justify-center overflow-hidden bg-[#77C3FA] text-xs text-white text-center whitespace-nowrap transition duration-500 dark:bg-blue-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Project item -->
                <div class="flex w-full flex-row text-sm">
                  <div class="mr-2">
                    <button
                      type="button"
                      class="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                    >
                      <Icon class="size-4" name="lucide:folder-kanban" />
                    </button>
                  </div>
                  <div class="flex w-full flex-col">
                    <div class="font-medium py-0.5">Projeto 2</div>
                    <div class="flex items-center">
                      <div class="w-40 text-xs leading-none">
                        78% <span class="text-neutral-200">•</span> 69 dias
                      </div>
                      <!-- Progress -->
                      <div
                        class="flex w-full h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-neutral-700"
                        role="progressbar"
                        aria-valuenow="78"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div
                          class="w-[78%] flex flex-col justify-center overflow-hidden bg-[#77C3FA] text-xs text-white text-center whitespace-nowrap transition duration-500 dark:bg-blue-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Project item -->
                <div class="flex w-full flex-row text-sm">
                  <div class="mr-2">
                    <button
                      type="button"
                      class="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                    >
                      <Icon class="size-4" name="lucide:folder-kanban" />
                    </button>
                  </div>
                  <div class="flex w-full flex-col">
                    <div class="font-medium py-0.5">Projeto 3</div>
                    <div class="flex items-center">
                      <div class="w-40 text-xs leading-none">
                        19% <span class="text-neutral-200">•</span> 9 dias
                      </div>
                      <!-- Progress -->
                      <div
                        class="flex w-full h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-neutral-700"
                        role="progressbar"
                        aria-valuenow="19"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div
                          class="w-[19%] flex flex-col justify-center overflow-hidden bg-[#77C3FA] text-xs text-white text-center whitespace-nowrap transition duration-500 dark:bg-blue-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts"></script>
