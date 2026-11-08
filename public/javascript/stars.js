// 5-star ratings, shared by every page. Ratings are stored as 0.5-5 in half-star steps.

const STAR_STEP = 0.5;
const MAX_STARS = 5;

// A rating shown as five stars filled to the value (half stars included), e.g. 4.5 -> ★★★★½
function renderStars(rating, { showNumber = false } = {}) {
    if (typeof rating !== 'number' || Number.isNaN(rating)) {
        return '<span class="card-unrated">Not rated</span>';
    }
    const stars = Math.max(0, Math.min(MAX_STARS, rating));
    const label = formatStars(stars);
    return `<span class="card-stars" title="${label} out of 5" aria-label="Rated ${label} out of 5">` +
        `<span class="card-stars-fill" style="width: ${(stars / MAX_STARS) * 100}%"></span></span>` +
        (showNumber ? ` <span class="stars-number">${label}</span>` : '');
}

// 4.5 -> "4.5", 5 -> "5"
function formatStars(rating) {
    return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

// A clickable 5-star input with half stars: click the left half of a star for a half.
// Arrow keys change it by half a star; Backspace or "Clear" removes the rating.
// Returns { get value(), set value(rating), set disabled(flag) }; value is null when unrated.
function createStarInput(container, { value = null, onChange = () => {} } = {}) {
    let current = value;
    container.classList.add('star-input');
    container.innerHTML = `
        <span class="star-input-stars" role="slider" tabindex="0" aria-label="Rating"
              aria-valuemin="0" aria-valuemax="${MAX_STARS}"></span>
        <span class="star-input-label"></span>
        <button type="button" class="star-input-clear">Clear</button>
    `;
    const starsElement = container.querySelector('.star-input-stars');
    const label = container.querySelector('.star-input-label');
    const clearButton = container.querySelector('.star-input-clear');
    for (let i = 1; i <= MAX_STARS; i++) {
        const star = document.createElement('span');
        star.className = 'star-input-star';
        star.dataset.star = i;
        star.innerHTML = '<span class="star-input-star-fill"></span>';
        starsElement.appendChild(star);
    }

    const valueAt = (event) => {
        const star = event.target.closest('.star-input-star');
        if (!star) return null;
        const box = star.getBoundingClientRect();
        const leftHalf = event.clientX - box.left < box.width / 2;
        return Number(star.dataset.star) - (leftHalf ? STAR_STEP : 0);
    };

    const paint = (shown) => {
        starsElement.querySelectorAll('.star-input-star').forEach(star => {
            const fill = Math.max(0, Math.min(1, (shown ?? 0) - (Number(star.dataset.star) - 1)));
            star.querySelector('.star-input-star-fill').style.width = `${fill * 100}%`;
        });
        label.textContent = shown == null ? 'Not rated' : `${formatStars(shown)} / 5`;
        clearButton.hidden = current == null;
        starsElement.setAttribute('aria-valuenow', current ?? 0);
        starsElement.setAttribute('aria-valuetext', current == null ? 'Not rated' : `${formatStars(current)} stars`);
    };

    const set = (rating, notify = true) => {
        current = rating == null ? null : Math.max(STAR_STEP, Math.min(MAX_STARS, Math.round(rating / STAR_STEP) * STAR_STEP));
        paint(current);
        if (notify) onChange(current);
    };

    let disabled = false;
    starsElement.addEventListener('mousemove', event => { if (!disabled) paint(valueAt(event) ?? current); });
    starsElement.addEventListener('mouseleave', () => paint(current));
    starsElement.addEventListener('click', event => {
        if (disabled) return;
        const rating = valueAt(event);
        if (rating != null) set(rating);
    });
    starsElement.addEventListener('keydown', event => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') set((current ?? 0) + STAR_STEP);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') set(current == null ? null : current - STAR_STEP < STAR_STEP ? null : current - STAR_STEP);
        else if (event.key === 'Backspace' || event.key === 'Delete') set(null);
        else return;
        event.preventDefault();
    });
    clearButton.addEventListener('click', () => { if (!disabled) set(null); });

    set(value, false);
    return {
        get value() { return current; },
        set value(rating) { set(rating, false); },
        set disabled(flag) {
            disabled = flag;
            container.classList.toggle('star-input-disabled', flag);
            starsElement.tabIndex = flag ? -1 : 0;
        },
    };
}
