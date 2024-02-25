<script lang="ts">
    import '$lib/app.sass'
    import Octicon from '$lib/octicon.svelte'
</script>

<svelte:head>
    <title>Weston Fribley</title>
</svelte:head>

<header>
    <section>
        <div>
            <h1>Weston</h1>
            <h1>Fribley</h1>
        </div>
    </section>
    <aside>
        <a href="./FribleyResume.pdf" target="_blank"><Octicon label="Resume" icon="file" size="34"></Octicon></a>
        <a href="mailto:me@westonfribley.com"><Octicon label="Email" icon="mail" size="34"></Octicon></a>
    </aside>
</header>

<hr>

<main>
    <h2 class="callout">Front End Engineer</h2>
</main>

<footer>
    <small>
        <a href="https://github.com/wfribley/westonfribley.com" target="_blank">
            see the code &nbsp;<Octicon label="GitHub" icon="code"></Octicon>
        </a>
    </small>
</footer>
