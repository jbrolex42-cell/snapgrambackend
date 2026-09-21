const Live = require("../models/Live");

function registerLiveSocket(io, socket) {
  /*
   * JOIN LIVE
   */
  socket.on(
    "live:join",
    async ({
      liveId,
      user,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        const live =
          await Live.findOne({
            _id: liveId,
            status: "live",
            isActive: true,
          }).populate(
            "host",
            "username fullName avatar isVerified"
          );

        if (!live) {
          socket.emit(
            "live:unavailable",
            {
              liveId,
              reason:
                "Live session is no longer available",
            }
          );

          return;
        }

        const room =
          `live:${liveId}`;

        socket.join(room);

        socket.liveId =
          String(liveId);

        const currentUserId =
          String(
            socket.userId ||
              user?.id ||
              user?._id ||
              ""
          );

        const hostId =
          String(
            live.host?._id ||
              live.host
          );

        socket.liveHost =
          currentUserId ===
          hostId;

        /*
         * Increase viewer count
         * for non-host viewers.
         */
        if (!socket.liveHost) {
          const updatedLive =
            await Live.findOneAndUpdate(
              {
                _id: liveId,
                status: "live",
                isActive: true,
              },
              {
                $inc: {
                  viewerCount: 1,
                },
              },
              {
                new: true,
              }
            );

          if (updatedLive) {
            if (
              updatedLive.viewerCount >
              updatedLive.peakViewerCount
            ) {
              updatedLive.peakViewerCount =
                updatedLive.viewerCount;

              await updatedLive.save();
            }

            io.to(room).emit(
              "live:viewer-count",
              {
                liveId:
                  String(liveId),

                viewerCount:
                  updatedLive.viewerCount,

                peakViewerCount:
                  updatedLive.peakViewerCount,
              }
            );
          }
        }

        socket
          .to(room)
          .emit(
            "live:user-joined",
            {
              liveId:
                String(liveId),

              user:
                user || null,

              userId:
                currentUserId,

              isHost:
                socket.liveHost,
            }
          );

        socket.emit(
          "live:joined",
          {
            liveId:
              String(liveId),

            live,

            isHost:
              socket.liveHost,

            room,
          }
        );

        console.log(
          `Live joined: ${
            currentUserId ||
            socket.id
          } -> ${liveId}`
        );
      } catch (error) {
        console.error(
          "LIVE JOIN SOCKET ERROR:",
          error
        );

        socket.emit(
          "live:error",
          {
            liveId,
            message:
              "Unable to join live",
          }
        );
      }
    }
  );

  /*
   * LEAVE LIVE
   */
  socket.on(
    "live:leave",
    async ({
      liveId,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        const room =
          `live:${liveId}`;

        if (!socket.liveHost) {
          const live =
            await Live.findOneAndUpdate(
              {
                _id: liveId,
                status: "live",
                isActive: true,
                viewerCount: {
                  $gt: 0,
                },
              },
              {
                $inc: {
                  viewerCount: -1,
                },
              },
              {
                new: true,
              }
            );

          if (live) {
            io.to(room).emit(
              "live:viewer-count",
              {
                liveId:
                  String(liveId),

                viewerCount:
                  live.viewerCount,

                peakViewerCount:
                  live.peakViewerCount,
              }
            );
          }
        }

        socket
          .to(room)
          .emit(
            "live:user-left",
            {
              liveId:
                String(liveId),

              userId:
                String(
                  socket.userId ||
                    ""
                ),
            }
          );

        socket.leave(room);

        socket.liveId = null;
        socket.liveHost = false;

        console.log(
          `Live left: ${
            socket.userId ||
            socket.id
          } -> ${liveId}`
        );
      } catch (error) {
        console.error(
          "LIVE LEAVE SOCKET ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE WEBRTC OFFER
   */
  socket.on(
    "live:offer",
    ({
      liveId,
      targetUserId,
      offer,
    } = {}) => {
      try {
        if (
          !liveId ||
          !targetUserId ||
          !offer
        ) {
          return;
        }

        const targetSockets =
          io.connectedUsers?.get(
            String(targetUserId)
          );

        if (!targetSockets) {
          return;
        }

        if (
          targetSockets instanceof
          Set
        ) {
          for (
            const socketId of
              targetSockets
          ) {
            io.to(socketId).emit(
              "live:offer",
              {
                liveId:
                  String(liveId),

                offer,

                senderId:
                  String(
                    socket.userId ||
                      ""
                  ),
              }
            );
          }
        } else {
          io.to(
            targetSockets
          ).emit(
            "live:offer",
            {
              liveId:
                String(liveId),

              offer,

              senderId:
                String(
                  socket.userId ||
                    ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "LIVE OFFER ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE WEBRTC ANSWER
   */
  socket.on(
    "live:answer",
    ({
      liveId,
      targetUserId,
      answer,
    } = {}) => {
      try {
        if (
          !liveId ||
          !targetUserId ||
          !answer
        ) {
          return;
        }

        const targetSockets =
          io.connectedUsers?.get(
            String(targetUserId)
          );

        if (!targetSockets) {
          return;
        }

        if (
          targetSockets instanceof
          Set
        ) {
          for (
            const socketId of
              targetSockets
          ) {
            io.to(socketId).emit(
              "live:answer",
              {
                liveId:
                  String(liveId),

                answer,

                senderId:
                  String(
                    socket.userId ||
                      ""
                  ),
              }
            );
          }
        } else {
          io.to(
            targetSockets
          ).emit(
            "live:answer",
            {
              liveId:
                String(liveId),

              answer,

              senderId:
                String(
                  socket.userId ||
                    ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "LIVE ANSWER ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE ICE CANDIDATE
   */
  socket.on(
    "live:ice-candidate",
    ({
      liveId,
      targetUserId,
      candidate,
    } = {}) => {
      try {
        if (
          !liveId ||
          !targetUserId ||
          !candidate
        ) {
          return;
        }

        const targetSockets =
          io.connectedUsers?.get(
            String(targetUserId)
          );

        if (!targetSockets) {
          return;
        }

        if (
          targetSockets instanceof
          Set
        ) {
          for (
            const socketId of
              targetSockets
          ) {
            io.to(socketId).emit(
              "live:ice-candidate",
              {
                liveId:
                  String(liveId),

                candidate,

                senderId:
                  String(
                    socket.userId ||
                      ""
                  ),
              }
            );
          }
        } else {
          io.to(
            targetSockets
          ).emit(
            "live:ice-candidate",
            {
              liveId:
                String(liveId),

              candidate,

              senderId:
                String(
                  socket.userId ||
                    ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "LIVE ICE CANDIDATE ERROR:",
          error
        );
      }
    }
  );

  /*
   * STREAM READY
   */
  socket.on(
    "live:stream-ready",
    ({
      liveId,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        if (!socket.liveHost) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:stream-ready",
          {
            liveId:
              String(liveId),

            hostId:
              String(
                socket.userId ||
                  ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "LIVE STREAM READY ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE COMMENT
   */
  socket.on(
    "live:comment",
    async ({
      liveId,
      text,
      user,
    } = {}) => {
      try {
        if (
          !liveId ||
          !text ||
          !String(text).trim()
        ) {
          return;
        }

        const live =
          await Live.findOne({
            _id: liveId,
            status: "live",
            isActive: true,
          });

        if (!live) {
          return;
        }

        const cleanText =
          String(text)
            .trim()
            .slice(0, 300);

        await Live.findByIdAndUpdate(
          liveId,
          {
            $inc: {
              commentsCount: 1,
            },
          }
        );

        const comment = {
          liveId:
            String(liveId),

          userId:
            String(
              socket.userId ||
                ""
            ),

          user:
            user || null,

          text:
            cleanText,

          createdAt:
            new Date(),
        };

        io.to(
          `live:${liveId}`
        ).emit(
          "live:comment",
          comment
        );
      } catch (error) {
        console.error(
          "LIVE COMMENT SOCKET ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE LIKE
   */
  socket.on(
    "live:like",
    async ({
      liveId,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        const live =
          await Live.findOneAndUpdate(
            {
              _id: liveId,
              status: "live",
              isActive: true,
            },
            {
              $inc: {
                likesCount: 1,
              },
            },
            {
              new: true,
            }
          );

        if (!live) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:like",
          {
            liveId:
              String(liveId),

            userId:
              String(
                socket.userId ||
                  ""
              ),

            likesCount:
              live.likesCount,
          }
        );
      } catch (error) {
        console.error(
          "LIVE LIKE SOCKET ERROR:",
          error
        );
      }
    }
  );

  /*
   * LIVE HEART
   */
  socket.on(
    "live:heart",
    ({
      liveId,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:heart",
          {
            liveId:
              String(liveId),

            userId:
              String(
                socket.userId ||
                  ""
              ),

            timestamp:
              Date.now(),
          }
        );
      } catch (error) {
        console.error(
          "LIVE HEART SOCKET ERROR:",
          error
        );
      }
    }
  );

  /*
   * PIN COMMENT
   */
  socket.on(
    "live:pin-comment",
    ({
      liveId,
      commentId,
    } = {}) => {
      try {
        if (
          !liveId ||
          !commentId
        ) {
          return;
        }

        if (!socket.liveHost) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:comment-pinned",
          {
            liveId:
              String(liveId),

            commentId:
              String(commentId),
          }
        );
      } catch (error) {
        console.error(
          "LIVE PIN COMMENT ERROR:",
          error
        );
      }
    }
  );

  /*
   * HOST MUTE
   */
  socket.on(
    "live:mute",
    ({
      liveId,
      muted,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        if (!socket.liveHost) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:host-mute",
          {
            liveId:
              String(liveId),

            muted:
              Boolean(muted),
          }
        );
      } catch (error) {
        console.error(
          "LIVE MUTE ERROR:",
          error
        );
      }
    }
  );

  /*
   * END LIVE
   */
  socket.on(
    "live:end",
    ({
      liveId,
    } = {}) => {
      try {
        if (!liveId) {
          return;
        }

        if (!socket.liveHost) {
          return;
        }

        io.to(
          `live:${liveId}`
        ).emit(
          "live:ended",
          {
            liveId:
              String(liveId),

            hostId:
              String(
                socket.userId ||
                  ""
              ),
          }
        );

        io.in(
          `live:${liveId}`
        ).socketsLeave(
          `live:${liveId}`
        );

        socket.liveId = null;
        socket.liveHost = false;
      } catch (error) {
        console.error(
          "LIVE END SOCKET ERROR:",
          error
        );
      }
    }
  );

  /*
   * SOCKET DISCONNECT
   */
  socket.on(
    "disconnect",
    async () => {
      try {
        const liveId =
          socket.liveId;

        if (!liveId) {
          return;
        }

        if (socket.liveHost) {
          console.log(
            "LIVE HOST DISCONNECTED:",
            socket.userId
          );

          return;
        }

        const live =
          await Live.findOneAndUpdate(
            {
              _id: liveId,
              status: "live",
              isActive: true,
              viewerCount: {
                $gt: 0,
              },
            },
            {
              $inc: {
                viewerCount: -1,
              },
            },
            {
              new: true,
            }
          );

        if (live) {
          io.to(
            `live:${liveId}`
          ).emit(
            "live:viewer-count",
            {
              liveId:
                String(liveId),

              viewerCount:
                live.viewerCount,

              peakViewerCount:
                live.peakViewerCount,
            }
          );
        }

        console.log(
          `LIVE VIEWER DISCONNECTED: ${
            socket.userId ||
            socket.id
          }`
        );
      } catch (error) {
        console.error(
          "LIVE DISCONNECT ERROR:",
          error
        );
      }
    }
  );

  console.log(
    `Live socket registered: ${socket.id}`
  );
}

module.exports = registerLiveSocket;