<script lang="ts">
	import { env } from '$env/dynamic/public';

	let { clientId } = $props<{ clientId: string }>();
</script>

<svelte:head>
	<script src="https://accounts.google.com/gsi/client" async></script>
</svelte:head>

<div
	id="g_id_onload"
	data-client_id={clientId}
	data-login_uri="/google/callback/"
	data-auto_prompt="true"
	data-context="signin"
	data-ux_mode="redirect"
	data-itp_support="true"
></div>

<div
	class="g_id_signin"
	data-type="standard"
	data-shape="pill"
	data-theme="filled_black"
	data-text="signin_with"
	data-size="medium"
	data-logo_alignment="left"
></div>
