<template>
  <div>
    <!-- Header -->
    <header
      class="sticky top-0 inset-x-0 h-16 w-full flex flex-wrap flex-shrink-0 md:justify-start md:flex-nowrap z-[48] bg-[#FDFDFD] border-b text-sm py-2.5 lg:ps-[260px] dark:bg-neutral-800 dark:border-neutral-700"
    >
      <nav class="px-4 flex items-center w-full">
        <div class="w-full flex items-center justify-between gap-x-2">
          <!-- Navigation Toggle -->
          <div class="lg:hidden">
            <button
              type="button"
              class="size-[38px] relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="hs-application-sidebar"
              aria-label="Toggle navigation"
              data-hs-overlay="#hs-application-sidebar"
            >
              <span class="sr-only">Exibir menu lateral</span>
              <Icon name="lucide:menu" class="shrink-0 size-5" />
            </button>
          </div>
          <!-- Title -->
          <div class="hidden sm:flex items-center gap-x-2">
            <h2
              class="text-xl font-medium text-neutral-800 dark:text-neutral-100"
            >
              Visão geral
            </h2>
          </div>
          <!-- Buttons & dropdown -->
          <div class="flex flex-row items-center justify-end gap-1">
            <!-- Button-->
            <button
              type="button"
              class="size-[38px] relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            >
              <Icon name="lucide:circle-help" class="shrink-0 size-4" />
              <span class="sr-only">Ajuda</span>
            </button>
            <!-- Button-->
            <button
              type="button"
              class="size-[38px] relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            >
              <Icon name="lucide:activity" class="shrink-0 size-4" />
              <span class="sr-only">Atividades</span>
            </button>
            <!-- Button-->
            <button
              type="button"
              class="size-[38px] relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            >
              <Icon name="lucide:settings" class="shrink-0 size-4" />
              <span class="sr-only">Configurações</span>
            </button>
            <!-- Divider -->
            <div
              class="h-8 w-0.5 mx-1 bg-neutral-100 dark:bg-neutral-800"
            ></div>
            <!-- Button-->
            <div class="relative inline-block">
              <button
                type="button"
                class="size-[38px] relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
              >
                <Icon name="lucide:inbox" class="shrink-0 size-4" />
                <span class="flex absolute top-0 end-0 size-2.5">
                  <span
                    class="animate-ping absolute inline-flex size-full rounded-full bg-red-400 opacity-75 dark:bg-red-600"
                  ></span>
                  <span
                    class="relative inline-flex rounded-full size-2.5 bg-red-500"
                  ></span>
                </span>
                <span class="sr-only">Mensagens</span>
              </button>
            </div>

            <!-- Divider -->
            <div
              class="h-8 w-0.5 mx-1 bg-neutral-100 dark:bg-neutral-800"
            ></div>
            <!-- Dropdown -->
            <div
              class="hs-dropdown [--placement:bottom-right] relative inline-flex"
            >
              <button
                id="hs-dropdown-account"
                type="button"
                class="inline-flex justify-center items-center group gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 focus:outline-none disabled:opacity-50 disabled:pointer-events-none dark:text-white"
                aria-haspopup="menu"
                aria-expanded="false"
                aria-label="Dropdown"
              >
                <!-- <div class="relative inline-block">
									<span class="inline-flex items-center justify-center size-[46px] rounded-full bg-neutral-500 text-sm font-semibold text-white leading-none border-2 group-hover:border-4 group-focus:border-4 border-neutral-200 dark:border-neutral-700 group-focus:border-neutral-200 dark:group-focus:border-neutral-700">MJ</span>
									<span class="absolute bottom-0 end-0 block size-3 rounded-full ring-2 ring-white bg-teal-400 dark:ring-neutral-800"></span>
								</div> -->
                <div class="relative inline-block">
                  <img
                    class="inline-block size-[46px] rounded-full border-2 group-hover:border-4 group-focus:border-4 border-neutral-200 dark:border-neutral-700 group-focus:border-neutral-200 dark:group-focus:border-neutral-700"
                    :src="user.avatar"
                    alt="Avatar"
                  />
                  <span
                    class="absolute bottom-0 end-0 block size-3 rounded-full ring-2 ring-white bg-teal-400 dark:ring-neutral-800"
                  ></span>
                </div>
                <div
                  class="flex rounded-full size-6 items-center justify-center shrink-0 group-hover:bg-neutral-100 group-focus:bg-neutral-100 dark:group-hover:bg-neutral-700 dark:group-focus:bg-neutral-700"
                >
                  <Icon
                    name="lucide:chevron-down"
                    class="shrink-0 size-4 text-neutral-400"
                  />
                </div>
              </button>
              <!-- Dropdown Menu -->
              <div
                class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-60 bg-white shadow-md rounded-lg mt-2 dark:bg-neutral-800 dark:border dark:border-neutral-700 dark:divide-neutral-700 after:h-4 after:absolute after:-bottom-4 after:start-0 after:w-full before:h-4 before:absolute before:-top-4 before:start-0 before:w-full"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="hs-dropdown-account"
              >
                <div
                  class="py-3 px-5 bg-gray-100 rounded-t-lg dark:bg-neutral-700"
                >
                  <p
                    class="text-sm font-medium text-gray-800 dark:text-neutral-200"
                  >
                    {{ user.username }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-neutral-400">
                    {{ user.team }}
                  </p>
                </div>
                <div class="p-1.5 space-y-0.5">
                  <a
                    class="flex items-center gap-x-3 py-2 px-3 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
                    href="#"
                  >
                    <Icon
                      name="lucide:user-round-pen"
                      class="shrink-0 size-4 text-neutral-400"
                    />
                    Alterar perfil
                  </a>
                  <a
                    class="flex items-center gap-x-3 py-2 px-3 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
                    href="#"
                  >
                    <Icon
                      name="lucide:settings-2"
                      class="shrink-0 size-4 text-neutral-400"
                    />
                    Preferências
                  </a>
                  <a
                    class="flex items-center gap-x-3 py-2 px-3 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
                    href="#"
                  >
                    <Icon
                      name="lucide:shield-check"
                      class="shrink-0 size-4 text-neutral-400"
                    />
                    Segurança
                  </a>
                  <a
                    class="flex items-center gap-x-3 py-2 px-3 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
                    href="#"
                  >
                    <Icon
                      name="lucide:log-out"
                      class="shrink-0 size-4 text-neutral-400"
                    />
                    Sair
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <!-- Sidebar -->
    <div
      id="hs-application-sidebar"
      class="hs-overlay [--auto-close:lg] hs-overlay-open:translate-x-0 -translate-x-full transition-all duration-300 transform w-[260px] h-full hidden fixed inset-y-0 start-0 z-[60] bg-[#FDFDFD] border-e border-gray-200 lg:block lg:translate-x-0 lg:end-auto lg:bottom-0 dark:bg-neutral-800 dark:border-neutral-700"
      role="dialog"
      tabindex="-1"
      aria-label="Sidebar"
    >
      <!-- Body -->
      <div class="relative flex flex-col h-full max-h-full">
        <div
          class="px-4 h-16 flex flex-shrink-0 items-center justify-between border-b border-b-transparent"
        >
          <!-- Logo -->
          <div class="flex gap-2">
            <NuxtImg
              src="/logo.png"
              alt="Logo"
              width="32"
              height="32"
              class="block"
            />
            <div class="block text-2xl font-bold dark:text-white">Silo</div>
          </div>
          <div class="flex gap-2">
            <!-- Toogle dark/light mode -->
            <div class="flex">
              <button
                type="button"
                class="hs-dark-mode-active:block hidden hs-dark-mode font-medium text-gray-100 dark:text-gray-400 rounded-full hover:bg-neutral-700 focus:outline-none focus:bg-neutral-200"
                data-hs-theme-click-value="light"
              >
                <span
                  class="group inline-flex shrink-0 justify-center items-center size-8"
                >
                  <Icon name="lucide:sun" class="shrink-0 size-4" />
                </span>
                <span class="sr-only">Modo claro</span>
              </button>
              <button
                type="button"
                class="hs-dark-mode-active:hidden block hs-dark-mode font-medium text-gray-400 rounded-full hover:bg-gray-200 focus:outline-none focus:bg-gray-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
                data-hs-theme-click-value="dark"
              >
                <span
                  class="group inline-flex shrink-0 justify-center items-center size-8"
                >
                  <Icon name="lucide:moon" class="shrink-0 size-4" />
                </span>
                <span class="sr-only">Modo escuro</span>
              </button>
            </div>
            <!-- Close Button -->
            <button
              type="button"
              class="lg:hidden size-8 relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
              data-hs-overlay="#hs-application-sidebar"
            >
              <Icon
                name="lucide:panel-left-close"
                class="shrink-0 size-4 text-gray-400 dark:text-gray-600"
              />
              <span class="sr-only">Fechar</span>
            </button>
          </div>
        </div>
        <!-- Content -->
        <div
          class="h-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
        >
          <!-- Container -->
          <div class="flex flex-col justify-between h-full w-full">
            <!-- Top -->
            <div class="flex w-full">
              <!-- Menu -->
              <ul class="flex flex-col w-full">
                <!-- Menu group -->
                <li class="pt-6">
                  <div class="px-4 text-xs uppercase text-gray-400">
                    Menu principal
                  </div>
                  <nav
                    class="hs-accordion-group p-3 w-full flex flex-col flex-wrap"
                    data-hs-accordion-always-open
                  >
                    <ul class="flex flex-col space-y-1">
                      <!-- Item -->
                      <li>
                        <a
                          class="flex items-center gap-x-3 font-medium py-2 px-2.5 bg-gray-100 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-700 dark:text-white"
                          href="#"
                        >
                          <Icon
                            name="lucide:house"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Visão geral
                        </a>
                      </li>
                      <!-- Item -->
                      <li class="hs-accordion" id="users-accordion">
                        <button
                          type="button"
                          class="hs-accordion-toggle w-full text-start flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200"
                          aria-expanded="true"
                          aria-controls="users-accordion-child"
                        >
                          <Icon
                            name="lucide:folder-git-2"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Produtos & tasks
                          <Icon
                            name="lucide:chevron-up"
                            class="hs-accordion-active:block ms-auto hidden size-4 text-gray-400"
                          />
                          <Icon
                            name="lucide:chevron-down"
                            class="hs-accordion-active:hidden ms-auto block size-4 text-gray-400"
                          />
                        </button>
                        <div
                          id="users-accordion-child"
                          class="hs-accordion-content w-full overflow-hidden transition-[height] duration-300 hidden"
                          role="region"
                          aria-labelledby="users-accordion"
                        >
                          <ul
                            class="hs-accordion-group ps-8 pt-1 space-y-1"
                            data-hs-accordion-always-open
                          >
                            <li class="hs-accordion" id="users-accordion-sub-1">
                              <button
                                type="button"
                                class="hs-accordion-toggle w-full text-start flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200"
                                aria-expanded="true"
                                aria-controls="users-accordion-sub-1-child"
                              >
                                BAM
                                <Icon
                                  name="lucide:chevron-up"
                                  class="hs-accordion-active:block ms-auto hidden size-4 text-gray-400"
                                />
                                <Icon
                                  name="lucide:chevron-down"
                                  class="hs-accordion-active:hidden ms-auto block size-4 text-gray-400"
                                />
                              </button>
                              <div
                                id="users-accordion-sub-1-child"
                                class="hs-accordion-content w-full overflow-hidden transition-[height] duration-300 hidden"
                                role="region"
                                aria-labelledby="users-accordion-sub-1"
                              >
                                <ul class="pt-1 space-y-1">
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 1
                                    </a>
                                  </li>
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 2
                                    </a>
                                  </li>
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 3
                                    </a>
                                  </li>
                                </ul>
                              </div>
                            </li>
                            <li class="hs-accordion" id="users-accordion-sub-2">
                              <button
                                type="button"
                                class="hs-accordion-toggle w-full text-start flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200"
                                aria-expanded="true"
                                aria-controls="users-accordion-sub-2-child"
                              >
                                SMEC
                                <Icon
                                  name="lucide:chevron-up"
                                  class="hs-accordion-active:block ms-auto hidden size-4 text-gray-400"
                                />
                                <Icon
                                  name="lucide:chevron-down"
                                  class="hs-accordion-active:hidden ms-auto block size-4 text-gray-400"
                                />
                              </button>
                              <div
                                id="users-accordion-sub-2-child"
                                class="hs-accordion-content w-full overflow-hidden transition-[height] duration-300 hidden"
                                role="region"
                                aria-labelledby="users-accordion-sub-2"
                              >
                                <ul class="pt-1 space-y-1">
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 1
                                    </a>
                                  </li>
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 2
                                    </a>
                                  </li>
                                  <li>
                                    <a
                                      class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                      href="#"
                                    >
                                      Link 3
                                    </a>
                                  </li>
                                </ul>
                              </div>
                            </li>
                            <li>
                              <a
                                class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                href="#"
                                >BRAMS ams 15 km</a
                              >
                            </li>
                            <li>
                              <a
                                class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                href="#"
                                >WRF</a
                              >
                            </li>
                          </ul>
                        </div>
                      </li>
                      <!-- Item -->
                      <li>
                        <a
                          class="w-full flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 dark:text-neutral-200 dark:hover:text-neutral-300"
                          href="#"
                        >
                          <Icon
                            name="lucide:square-chart-gantt"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Projetos
                        </a>
                      </li>
                      <!-- Item -->
                      <li>
                        <a
                          class="w-full flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 dark:text-neutral-200 dark:hover:text-neutral-300"
                          href="#"
                        >
                          <Icon
                            name="lucide:users-round"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Grupos
                        </a>
                      </li>
                    </ul>
                  </nav>
                </li>
                <!-- Menu group -->
                <li class="py-6">
                  <div class="px-4 text-xs uppercase text-gray-400">Outros</div>
                  <nav
                    class="hs-accordion-group p-3 w-full flex flex-col flex-wrap"
                    data-hs-accordion-always-open
                  >
                    <ul class="flex flex-col space-y-1">
                      <!-- Item -->
                      <li>
                        <a
                          class="w-full flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 dark:text-neutral-200 dark:hover:text-neutral-300"
                          href="#"
                        >
                          <Icon
                            name="lucide:calendar-clock"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Agenda
                        </a>
                      </li>
                      <!-- Item -->
                      <li>
                        <a
                          class="w-full flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 dark:text-neutral-200 dark:hover:text-neutral-300"
                          href="#"
                        >
                          <Icon
                            name="lucide:messages-square"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Bate-papo
                        </a>
                      </li>
                      <!-- Item -->
                      <li class="hs-accordion" id="projects-accordion">
                        <button
                          type="button"
                          class="hs-accordion-toggle w-full text-start flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200"
                          aria-expanded="true"
                          aria-controls="projects-accordion-child"
                        >
                          <Icon
                            name="lucide:settings-2"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Configurações
                          <Icon
                            name="lucide:chevron-up"
                            class="hs-accordion-active:block ms-auto hidden size-4 text-gray-400"
                          />
                          <Icon
                            name="lucide:chevron-down"
                            class="hs-accordion-active:hidden ms-auto block size-4 text-gray-400"
                          />
                        </button>
                        <!-- Item -->
                        <div
                          id="projects-accordion-child"
                          class="hs-accordion-content w-full overflow-hidden transition-[height] duration-300 hidden"
                          role="region"
                          aria-labelledby="projects-accordion"
                        >
                          <ul class="ps-8 pt-1 space-y-1">
                            <li>
                              <a
                                class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                href="#"
                                >Alterar perfil</a
                              >
                            </li>
                            <li>
                              <a
                                class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                href="#"
                                >Preferências</a
                              >
                            </li>
                            <li>
                              <a
                                class="flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:bg-neutral-800 dark:text-neutral-200"
                                href="#"
                                >Segurança</a
                              >
                            </li>
                          </ul>
                        </div>
                      </li>
                      <!-- Item -->
                      <li>
                        <a
                          class="w-full flex items-center gap-x-3 font-medium py-2 px-2.5 text-sm text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-300"
                          href="#"
                        >
                          <Icon
                            name="lucide:life-buoy"
                            class="shrink-0 size-4 text-gray-400"
                          />
                          Ajuda
                        </a>
                      </li>
                    </ul>
                  </nav>
                </li>
              </ul>
            </div>
            <!-- Bottom -->
            <div class="flex w-full">
              <!-- What's new block -->
              <div
                class="m-4 mt-auto rounded-lg bg-[#FAFAFA] dark:bg-neutral-700 border border-gray-200 dark:border-neutral-700 px-4 py-3 text-sm"
              >
                <div class="flex items-center justify-between">
                  <p
                    class="text-md font-semibold text-gray-800 dark:text-white"
                  >
                    O que há de novo?
                  </p>
                  <button
                    type="button"
                    class="size-8 relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                  >
                    <Icon name="lucide:x" class="size-4 text-gray-400" />
                  </button>
                </div>
                <p
                  class="text-medium text-sm mt-1 mb-2 text-gray-500 dark:text-gray-200"
                >
                  Você pode conferir todas as novidades dessa nova versão do
                  dashboard no aplicativo Silo.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="flex h-16 justify-between border-t border-t-transparent">
          <div class="flex w-full justify-between items-center gap-2 px-4">
            <div class="flex items-center gap-2">
              <img
                class="inline-block size-[40px] rounded-full"
                :src="user.avatar"
                alt="Avatar"
              />
              <div class="w-[140px]">
                <p
                  class="truncate text-sm font-medium leading-none text-neutral-700 dark:text-white"
                  v-html="user.username"
                />
                <p
                  class="truncate text-xs text-neutral-500 dark:text-neutral-300"
                  v-html="user.team"
                />
              </div>
            </div>
            <button
              type="button"
              class="size-8 relative inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            >
              <Icon name="lucide:log-out" class="size-4 text-gray-400" />
            </button>
          </div>
        </footer>
      </div>
    </div>
    <!-- End Sidebar -->

    <!-- Content -->
    <div class="w-full lg:pl-[260px]">
      <div class="h-[calc(100svh-64px)] dark:text-white">
        <!-- Page content -->
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const user = {
  avatar: "https://avatars.githubusercontent.com/u/141470722?v=4",
  username: "Mario Junior",
  team: "Engenheiro de software",
};
</script>
