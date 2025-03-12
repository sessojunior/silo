<script lang="ts">
	// Classes Tailwind
	let turn = 'flex h-5 w-5 items-center justify-end pt-0.5 pr-1 text-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	let day = 'py-2 flex-col rounded-sm bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'
	let dayWeekend = 'py-2 bg-neutral-50 rounded-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-600'
	let dayWeek = 'flex h-5 w-5 items-center justify-center text-xs text-neutral-300 dark:text-neutral-500'
	let dayNumber = 'flex h-5 w-5 items-center justify-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	let dayTurn = 'flex h-5 w-5 items-center justify-center'
	let dayButton = 'flex h-4 w-4 items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-600'
	let dayGreen = 'h-2.5 w-2.5 rounded-full bg-green-200 dark:bg-green-900'
	let dayOrange = 'h-2.5 w-2.5 rounded-full bg-orange-400'
	let dayRed = 'h-2.5 w-2.5 rounded-full bg-red-600'
	let dayNone = 'h-2.5 w-2.5 rounded-full bg-transparent'
</script>

<!-- Month -->
<div class="flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
	<div class="flex flex-col rounded-lg text-neutral-600 dark:text-neutral-400">
		<div class="text-md flex justify-between bg-neutral-100 px-4 py-3 text-neutral-800">
			<div class="text-neutral-600">Março</div>
			<div class="text-neutral-400">2025</div>
		</div>
		<div class="flex px-2">
			<!-- Turns -->
			<div class="flex-col py-2">
				<div class="h-5 w-5"></div>
				<div class="h-5 w-5"></div>
				<div class={turn}>0</div>
				<div class={turn}>6</div>
				<div class={turn}>12</div>
				<div class={turn}>18</div>
			</div>
			<!-- Day 1 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>1</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 02 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>D</div>
				<div class={dayNumber}>2</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 03 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>3</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayRed}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 04 -->
			<div class={day}>
				<div class={dayWeek}>T</div>
				<div class={dayNumber}>4</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 05 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>5</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 06 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>6</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 07 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>7</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 08 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>8</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 09 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>D</div>
				<div class={dayNumber}>9</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 10 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>10</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 11 -->
			<div class={day}>
				<div class={dayWeek}>T</div>
				<div class={dayNumber}>11</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 12 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>12</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 13 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>13</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
			</div>
			<!-- Day 14 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>14</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
			</div>
			<!-- Day 15 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>15</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 16 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>D</div>
				<div class={dayNumber}>16</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 17 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>17</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 18 -->
			<div class={day}>
				<div class={dayWeek}>T</div>
				<div class={dayNumber}>18</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 19 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>19</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 20 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>20</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayRed}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayRed}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
			</div>
			<!-- Day 21 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>21</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayGreen}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayOrange}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayNone}></div>
					</div>
				</div>
				<div class={dayTurn}>
					<div class={dayButton}>
						<div class={dayNone}></div>
					</div>
				</div>
			</div>
			<!-- Day 22 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>22</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 23 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>D</div>
				<div class={dayNumber}>23</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 24 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>24</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 25 -->
			<div class={day}>
				<div class={dayWeek}>T</div>
				<div class={dayNumber}>25</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 26 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>26</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 27 -->
			<div class={day}>
				<div class={dayWeek}>Q</div>
				<div class={dayNumber}>27</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 28 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>28</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 29 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>29</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 30 -->
			<div class={dayWeekend}>
				<div class={dayWeek}>D</div>
				<div class={dayNumber}>30</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
			<!-- Day 31 -->
			<div class={day}>
				<div class={dayWeek}>S</div>
				<div class={dayNumber}>31</div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
				<div class={dayTurn}></div>
			</div>
		</div>
	</div>
</div>
