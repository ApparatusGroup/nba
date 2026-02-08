export function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') element.className = value;
        else if (key === 'onclick' || key === 'onchange' || key === 'oninput') element[key] = value;
        else if (key === 'innerHTML') element.innerHTML = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
        else if (key === 'dataset') Object.assign(element.dataset, value);
        else element.setAttribute(key, value);
    });

    children.flat().forEach(child => {
        if (child == null) return;
        if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });

    return element;
}

export function renderTable(columns, rows, options = {}) {
    const table = el('table', { className: `data-table ${options.className || ''}` });

    // Header
    const thead = el('thead');
    const headerRow = el('tr');
    columns.forEach(col => {
        const th = el('th', {
            onclick: options.sortable ? () => {
                if (options.onSort) options.onSort(col.key);
            } : null
        }, col.label);
        if (col.align === 'right') th.style.textAlign = 'right';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = el('tbody');
    rows.forEach((row, idx) => {
        const tr = el('tr');
        if (options.rowClass) tr.className = options.rowClass(row, idx);
        if (options.onRowClick) {
            tr.style.cursor = 'pointer';
            tr.onclick = () => options.onRowClick(row);
        }

        columns.forEach(col => {
            const td = el('td');
            if (col.align === 'right') td.className = 'num';

            if (col.render) {
                const content = col.render(row, idx);
                if (typeof content === 'string') td.innerHTML = content;
                else if (content instanceof Node) td.appendChild(content);
                else td.textContent = content ?? '';
            } else {
                td.textContent = row[col.key] ?? '';
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
}

export function renderRatingBadge(rating) {
    let cls = 'rating-poor';
    if (rating >= 90) cls = 'rating-elite';
    else if (rating >= 80) cls = 'rating-great';
    else if (rating >= 70) cls = 'rating-good';
    else if (rating >= 60) cls = 'rating-avg';
    else if (rating >= 50) cls = 'rating-below';

    return el('span', { className: `rating-badge ${cls}` }, String(rating));
}

export function renderCard(title, content, options = {}) {
    const card = el('div', { className: `card ${options.className || ''}` });

    if (title) {
        const header = el('div', { className: 'card-header' });
        header.appendChild(el('h3', { className: 'card-title' }, title));
        if (options.headerRight) header.appendChild(options.headerRight);
        card.appendChild(header);
    }

    if (typeof content === 'string') {
        card.appendChild(el('div', { innerHTML: content }));
    } else if (content instanceof Node) {
        card.appendChild(content);
    }

    return card;
}

export function renderStatBox(label, value, color) {
    const box = el('div', { className: 'stat-box' });
    const valEl = el('div', { className: 'stat-value' }, String(value));
    if (color) valEl.style.color = `var(--${color})`;
    box.appendChild(valEl);
    box.appendChild(el('div', { className: 'stat-label' }, label));
    return box;
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = el('div', { className: `toast toast-${type}` }, message);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function showModal(title, bodyContent, buttons = []) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    overlay.className = 'modal-overlay';
    overlay.innerHTML = '';

    const modal = el('div', { className: 'modal animate-scale-in' });

    // Header
    const header = el('div', { className: 'modal-header' });
    header.appendChild(el('h2', {}, title));
    const closeBtn = el('span', { className: 'modal-close', onclick: () => hideModal() }, '\u00D7');
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = el('div', { className: 'modal-body' });
    if (typeof bodyContent === 'string') body.innerHTML = bodyContent;
    else if (bodyContent instanceof Node) body.appendChild(bodyContent);
    modal.appendChild(body);

    // Footer
    if (buttons.length > 0) {
        const footer = el('div', { className: 'modal-footer' });
        buttons.forEach(btn => {
            footer.appendChild(el('button', {
                className: `btn ${btn.className || 'btn-outline'}`,
                onclick: () => { if (btn.onClick) btn.onClick(); hideModal(); }
            }, btn.label));
        });
        modal.appendChild(footer);
    }

    overlay.appendChild(modal);

    // Close on overlay click
    overlay.onclick = (e) => { if (e.target === overlay) hideModal(); };
}

export function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.className = 'hidden';
        overlay.innerHTML = '';
    }
}
