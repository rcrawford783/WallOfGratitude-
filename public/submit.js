const form = document.getElementById('form');
const errorBox = document.getElementById('error');
const thanks = document.getElementById('thanks');
const submitBtn = document.getElementById('submit');
const message = document.getElementById('message');
const count = document.getElementById('count');
const fromInput = document.getElementById('from');

// Remember the guest's own name so they don't retype it for each message.
try {
  fromInput.value = localStorage.getItem('wog-from') || '';
} catch {}

message.addEventListener('input', () => {
  count.textContent = `${message.value.length} / 500`;
});

function showError(text) {
  errorBox.textContent = text;
  errorBox.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const data = {
    to: form.to.value.trim(),
    message: form.message.value.trim(),
    from: form.from.value.trim(),
  };
  if (!data.to || !data.message || !data.from) {
    showError('Please fill in all three fields.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  try {
    const res = await fetch('/api/compliments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Something went wrong. Please try again.');
    }
    try {
      localStorage.setItem('wog-from', data.from);
    } catch {}
    form.hidden = true;
    thanks.hidden = false;
  } catch (err) {
    showError(err.message === 'Failed to fetch' ? 'Could not reach the server. Please try again.' : err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send some gratitude';
  }
});

document.getElementById('again').addEventListener('click', () => {
  form.to.value = '';
  message.value = '';
  count.textContent = '0 / 500';
  thanks.hidden = true;
  form.hidden = false;
  form.to.focus();
});
