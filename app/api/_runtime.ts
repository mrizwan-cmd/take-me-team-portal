import { database } from "@/db";
import { objectStorage } from "@/lib/object-storage";

export const env = {
  DB: database,
  FILES: objectStorage,
};
