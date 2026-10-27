const form = document.querySelector('[data-contact-form]');

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.querySelector('[data-form-status]');
    status.textContent = 'Thank you. The website form is ready to connect to the AIIBP enquiry service during deployment configuration.';
    form.reset();
  });
}
