"use strict";

  // In-page replacements for window.confirm / window.prompt.
  function openAppDialog({ message, input, confirmText, cancelText, danger }) {
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const backdrop = document.createElement("div");
      backdrop.className = "edit-modal-backdrop app-dialog-backdrop";
      backdrop.innerHTML = `
        <div class="edit-modal app-dialog" role="alertdialog" aria-modal="true">
          <p class="app-dialog-message"></p>
          ${input ? `<input class="app-dialog-input" type="${input.type || "text"}" autocomplete="off">` : ""}
          <div class="edit-modal-actions">
            <button type="button" data-dialog="cancel"></button>
            <button type="button" data-dialog="ok" class="${danger ? "danger" : "primary"}"></button>
          </div>
        </div>`;
      $(".app-dialog-message", backdrop).textContent = message;
      $("[data-dialog='cancel']", backdrop).textContent = cancelText;
      $("[data-dialog='ok']", backdrop).textContent = confirmText;
      const field = $(".app-dialog-input", backdrop);

      let closed = false;
      const close = value => {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        backdrop.classList.add("closing");
        setTimeout(() => {
          backdrop.remove();
          previousFocus?.focus?.({ preventScroll: true });
        }, 160);
        resolve(value);
      };
      const accept = () => close(field ? field.value : true);
      const cancel = () => close(field ? null : false);
      const onKey = event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
          event.preventDefault();
          event.stopPropagation();
          accept();
        }
      };

      backdrop.addEventListener("click", event => {
        if (event.target === backdrop) cancel();
        const action = event.target.closest("[data-dialog]")?.dataset.dialog;
        if (action === "ok") accept();
        else if (action === "cancel") cancel();
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(backdrop);
      (field || $("[data-dialog='ok']", backdrop)).focus();
    });
  }

  function appConfirm(message, options = {}) {
    return openAppDialog({
      message,
      confirmText: options.confirmText || "OK",
      cancelText: options.cancelText || "Cancel",
      danger: options.danger ?? /delete|remove|clear/i.test(message)
    });
  }

  function appPrompt(message, options = {}) {
    return openAppDialog({
      message,
      input: { type: options.type || "text" },
      confirmText: options.confirmText || "OK",
      cancelText: options.cancelText || "Cancel",
      danger: false
    });
  }
