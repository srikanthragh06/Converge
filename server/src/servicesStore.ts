// Global services registry: single source of truth for all service instances.
// This is the only file that calls new on any service class.
// No business logic, no side-effects — only instantiation.

import { DatabaseService }      from "./db/DatabaseService";
import { HttpServerService }    from "./HttpServerService";
import { RedisService }         from "./redis/RedisService";
import { PersistenceService }   from "./db/PersistenceService";
import { CompactorService }     from "./db/CompactorService";
import { PubSubService }        from "./redis/PubSubService";
import { DocStoreService }      from "./store/DocStoreService";
import { SocketHandlerService } from "./sockets/SocketHandlerService";

export const servicesStore = {
    databaseService:      new DatabaseService(),
    httpServerService:    new HttpServerService(),
    redisService:         new RedisService(),
    persistenceService:   new PersistenceService(),
    compactorService:     new CompactorService(),
    pubSubService:        new PubSubService(),
    docStoreService:      new DocStoreService(),
    socketHandlerService: new SocketHandlerService(),
};
