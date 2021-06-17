import {
  GraphQLExecutionContext,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { BaseEntity, getMetadataArgsStorage } from 'typeorm';
import * as plularize from 'pluralize';
import { Filters } from '../filters/filtrable-field.decorator';
import { Loader } from '../loaders/query-exctractor.decorator';
import { Sorting } from '../sorting/sort.decorator';
import { Joins } from '../joins/join.decorator';
import { Paginate } from '../pagination/pagination.decorator';
import { addMethodToResolverClass } from '../helpers/decorators';
import { Having } from '../aggregations/having/having.decorator';

export const AutoResolver = (entity: BaseEntity): any => {
  return (baseResolverClass) => {
    const entityMeta = getMetadataArgsStorage();
    const relations = entityMeta.relations.filter(
      (x) => x.target['name'] == entity['name'],
    );

    const extend = (base) => {
      @Resolver(() => entity)
      class Extended extends base {
        constructor() {
          super();
          relations.forEach((r) => {
            if (Extended.prototype[r.propertyName]) return;

            if (r.relationType === 'many-to-one') {
              // Many to one. Example: competencies => seniority
              const methodName = r.propertyName;
              if (!Extended.prototype[methodName]) {
                addMethodToResolverClass({
                  resolverClass: Extended,
                  methodName,
                  methodDecorators: [
                    ResolveField(() => entity, { name: methodName }),
                  ],
                  paramDecorators: [
                    Loader(methodName),
                    Parent(),
                    Filters(),
                    Having(),
                    Sorting(entity),
                    Joins(),
                  ],
                  entity,
                  callback: (loader: GraphQLExecutionContext, parent) => {
                    return loader[methodName].load(parent[methodName + '_id']);
                  },
                });
              }
            }

            if (r.relationType === 'one-to-many') {
              // One to many. Example: seniority => competencies
              const methodName = r.propertyName;
              if (!Extended.prototype[methodName]) {
                addMethodToResolverClass({
                  resolverClass: Extended,
                  methodName,
                  methodDecorators: [
                    ResolveField(() => entity, { name: methodName }),
                  ],
                  paramDecorators: [
                    Loader([methodName, `${entity['name']}_id`.toLowerCase()]),
                    Parent(),
                    Filters(),
                    Having(),
                    Sorting(entity),
                    Joins(),
                  ],
                  entity,
                  callback: (loader: GraphQLExecutionContext, parent) => {
                    return loader[methodName].load(parent['id']);
                  },
                });
              }
            }
          });
          {
            const methodName = plularize(entity['name']).toLowerCase();
            if (!Extended.prototype[methodName]) {
              // loadMany for root queries

              addMethodToResolverClass({
                resolverClass: Extended,
                methodName,
                methodDecorators: [Query(() => [entity], { name: methodName })],
                paramDecorators: [
                  Loader(entity),
                  Filters(),
                  Having(),
                  Sorting(entity),
                  Paginate(),
                  Joins(),
                ],
                entity,
                callback: (loader: GraphQLExecutionContext) => {
                  return loader;
                },
              });
            }
          }
        }
      }

      Object.defineProperty(Extended, 'name', {
        value: entity['name'],
      });
      return Extended;
    };

    return extend(baseResolverClass);
  };
};
