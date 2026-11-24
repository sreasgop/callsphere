/**
 * Centralized Indian Standard Time (IST) formatting utility for CallSphere React Frontend
 */
export function formatISTTime(dateInput) {
    if (!dateInput) return '';
    let d;
    if (dateInput instanceof Date) {
        d = dateInput;
    } else if (typeof dateInput === 'number') {
        d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        let str = dateInput.trim();
        str = str.replace(' ', 'T');
        if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
            str += 'Z';
        }
        d = new Date(str);
    } else {
        d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}
