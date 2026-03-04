// 书籍页面交互逻辑
export const initBookInteractions = () => {
  // 添加书籍点击事件处理 - 打开对话框
  document.querySelectorAll('.book-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const dialogId = btn.getAttribute('data-dialog-id');
      if (dialogId) {
        const dialogs = document.querySelectorAll('.book-dialog');
        const dialog = dialogs[parseInt(dialogId, 10)];
        if (dialog) {
          (dialog as HTMLDialogElement).showModal();
        }
      }
    });
  });

  // 添加对话框关闭事件处理
  document.querySelectorAll('.book-dialog').forEach(dialog => {
    const closeBtn = dialog.querySelector('.close-dialog');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        (dialog as HTMLDialogElement).close();
      });
    }
    
    // 点击对话框外部关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        (dialog as HTMLDialogElement).close();
      }
    });
  });
};
