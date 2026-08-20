// Normaliza una placa a mayúsculas y sin espacios/guiones, para que
// "abc 123", "ABC-123" y "ABC123" se traten como el mismo vehículo.
export function normalizarPlaca(valor) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Formato visual con guion, solo para mostrar en pantalla (ej: ABC-123)
export function formatearPlaca(valor) {
  const limpio = normalizarPlaca(valor || '');
  if (limpio.length <= 3) return limpio;
  return limpio.slice(0, 3) + '-' + limpio.slice(3);
}
