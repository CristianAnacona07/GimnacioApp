/**
 * Plugin de borrado lógico (soft-delete).
 *
 * Añade el campo `deletedAt` (null = activo) y hace que TODAS las queries de
 * lectura (find/findOne/count/update...) excluyan automáticamente los documentos
 * borrados, salvo que la query pase la opción { withDeleted: true }.
 *
 * Uso en un schema:  schema.plugin(softDelete);
 * Para borrar:        await Modelo.softDelete({ _id });   // marca deletedAt
 * Para restaurar:     await Modelo.restore({ _id });
 * Para ver borrados:  Modelo.find(filtro).setOptions({ withDeleted: true });
 */
module.exports = function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
  });

  // Filtra los borrados en cualquier operación de lectura/actualización.
  const hooks = [
    'find', 'findOne', 'findOneAndUpdate', 'countDocuments',
    'count', 'updateMany', 'updateOne', 'findOneAndDelete',
  ];
  schema.pre(hooks, function () {
    // getOptions puede no existir en versiones antiguas; se protege con ?.
    const opts = (this.getOptions && this.getOptions()) || {};
    if (!opts.withDeleted) {
      this.where({ deletedAt: null });
    }
  });

  // Borrado lógico masivo.
  schema.statics.softDelete = function (filtro) {
    return this.updateMany(filtro, { $set: { deletedAt: new Date() } });
  };

  // Restaurar documentos borrados (hay que pasar withDeleted para alcanzarlos).
  schema.statics.restore = function (filtro) {
    return this.updateMany(filtro, { $set: { deletedAt: null } }, { withDeleted: true });
  };
};
