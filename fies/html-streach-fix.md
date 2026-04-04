<style>
/* ===== STRUCTURE CSS (your original, kept) ===== */

html,
body {
    margin: 0;
    padding: 0;
}

h1,
h2,
h3,
h4,
h5,
h6,
p {
    margin: 0;
}

.hud-container {
    transform: scaleY(1.9);
}

.hud-scale {
    zoom: 3;
    margin-top: 80.8px;
}

.hud-content {
    height: 179.7px;
    overflow: auto;

    display: flex;
    flex-direction: column;
}

.hud-content header {
    background: green;
}

.hud-content footer {
    background: green;
}

.hud-content main {
    background: red;
    flex-grow: 1;
    overflow-y: auto;
}
</style>



<div class="hud-root">
    <div class="hud-container">
        <div class="hud-scale">
            <div class="hud-content">
                <header>
                    I am header
                </header>
                <main>
                    I am content <br><br>
                    Lorem ipsum dolor sit amet...<br><br>
                    long content
                </main>
                <footer>
                    I am footer
                </footer>
            </div>
        </div>
    </div>
</div>

<script>
    function updateMainHeight() {
        const content = document.querySelector('.hud-content');
        if (!content) return;

        const header = content.querySelector('header');
        const footer = content.querySelector('footer');
        const main = content.querySelector('main');

        if (!main) return;

        const totalHeight = content.clientHeight;

        const headerHeight = header ? header.offsetHeight : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;

        const remaining = totalHeight - headerHeight - footerHeight;

        main.style.height = Math.max(0, remaining) + 'px';
    }

    // run on load
    window.addEventListener('load', updateMainHeight);

    // run on resize (important for SL scaling/zoom)
    window.addEventListener('resize', updateMainHeight);

    // also run when DOM is ready (extra safety)
    document.addEventListener('DOMContentLoaded', updateMainHeight);

    /* ===== EXTRA PRO TIP (auto detect changes) ===== */
    // If header/footer content changes dynamically
    const observer = new ResizeObserver(() => {
        updateMainHeight();
    });

    window.addEventListener('load', () => {
        const header = document.querySelector('header');
        const footer = document.querySelector('footer');

        if (header) observer.observe(header);
        if (footer) observer.observe(footer);
    });
</script>