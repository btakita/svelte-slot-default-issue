<script>
	export let href
</script>

<div class=Component>
	<slot name=test>
		<div class=test__Component>
			<slot name=test1>
				<a {href}>
					<slot name=test2>
						default value
					</slot>
				</a>
			</slot>
		</div>
	</slot>
	<slot></slot>
</div>