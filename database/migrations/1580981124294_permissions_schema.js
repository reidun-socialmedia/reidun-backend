'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class PermissionsSchema extends Schema {
  up () {
    this.create('permissions', (table) => {
      table.increments()
      table.string('slug',45).notNullable().unique();
    })
  }

  down () {
    this.drop('permissions')
  }
}

module.exports = PermissionsSchema
