-- Agregar tipo de operación (venta/alquiler) a propiedades
ALTER TABLE properties ADD COLUMN operation_type TEXT DEFAULT 'venta';
