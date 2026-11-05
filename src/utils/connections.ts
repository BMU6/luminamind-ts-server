import { isObjectIdOrHexString } from "mongoose";
import { User } from "#models";

// A doctor may only work with patients that are in his connectedUsers list
// (the list is filled when the patient redeems the invite code).

export const isValidId = (id: unknown): id is string =>
  typeof id === "string" && isObjectIdOrHexString(id);

export const getConnectedIds = async (userId: string): Promise<string[]> => {
  const user = await User.findById(userId).select("connectedUsers").lean();
  return (user?.connectedUsers ?? []).map(String);
};

export const isConnectedTo = async (
  userId: string,
  otherUserId: string,
): Promise<boolean> =>
  (await User.exists({ _id: userId, connectedUsers: otherUserId })) !== null;
