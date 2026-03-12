<script lang="ts">
	import QRCode from 'qrcode';

	interface Props {
		value: string;
		size?: number;
	}

	let { value, size = 200 }: Props = $props();

	let dataUrl = $state('');

	$effect(() => {
		QRCode.toDataURL(value, {
			width: size,
			margin: 2,
			color: { dark: '#000000', light: '#ffffff' }
		}).then((url) => {
			dataUrl = url;
		});
	});
</script>

{#if dataUrl}
	<img src={dataUrl} alt="QR code for {value}" width={size} height={size} class="rounded-xl" />
{/if}
