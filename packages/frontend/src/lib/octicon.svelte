<script lang="ts">
    import octicons from '@primer/octicons'

    export let label: string
    export let icon: octicons.IconName
    export let size: string = '16'

    const svg = octicons[icon].toSVG({
        'aria-label': label,
        height: parseInt(size),
        width: parseInt(size),
    })
</script>

<figure title="{label}">{@html svg}<figcaption>{label}</figcaption></figure>