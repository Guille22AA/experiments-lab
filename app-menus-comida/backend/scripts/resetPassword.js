// Forgot the password? Run on the PC where the app lives (from the project root):
//   npm run reset-password
// It deletes the password and logs out every device. The next time the app is
// opened it asks to create a new one. Your data (menus, pantry...) is kept.
const { deletePassword, deleteSessionsExcept } = await import('../src/db/repositories/authRepo.js');

deletePassword();
deleteSessionsExcept(null);
console.log('Contraseña borrada y sesiones cerradas. Abre la app para crear una nueva.');
