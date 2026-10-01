/**
 * Install:
 * 1. Run: make install
 * 2. X11: Restart gnome-shell (Alt+F2, r, Enter)
 * 3. Wayland: Logout and login
 * 4. Run: gnome-extensions enable sizer@duclm278.github.io
 *
 * Usage:
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.Get
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.Move 0 0
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.MoveResize 0 0 1600 900
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.Resize 1600 900
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.MoveInMonitor 0 0
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.MoveResizeInMonitor 0 0 1600 900
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.MoveInWorkArea 0 0
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.MoveResizeInWorkArea 0 0 1600 900
 * gdbus call --session --dest org.gnome.Shell --object-path /dev/duc/Sizer --method dev.duc.Sizer.CenterInWorkArea
 */

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const MR_DBUS_IFACE = `
<node>
    <interface name="dev.duc.Sizer">
        <method name="Get">
        </method>
        <method name="Move">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
        </method>
        <method name="MoveResize">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
            <arg type="u" direction="in" name="width"/>
            <arg type="u" direction="in" name="height"/>
        </method>
        <method name="Resize">
            <arg type="u" direction="in" name="width"/>
            <arg type="u" direction="in" name="height"/>
        </method>
        <method name="MoveInMonitor">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
        </method>
        <method name="MoveResizeInMonitor">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
            <arg type="u" direction="in" name="width"/>
            <arg type="u" direction="in" name="height"/>
        </method>
        <method name="MoveInWorkArea">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
        </method>
        <method name="MoveResizeInWorkArea">
            <arg type="u" direction="in" name="x"/>
            <arg type="u" direction="in" name="y"/>
            <arg type="u" direction="in" name="width"/>
            <arg type="u" direction="in" name="height"/>
        </method>
        <method name="CenterInWorkArea">
        </method>
    </interface>
</node>`;

export default class SizerExtension extends Extension {
  // https://gitlab.com/lundal/tactile/-/blob/v32/src/extension.ts
  enable() {
    this._dbus = Gio.DBusExportedObject.wrapJSObject(MR_DBUS_IFACE, this);
    this._dbus.export(Gio.DBus.session, "/dev/duc/Sizer");
  }

  // https://gitlab.com/lundal/tactile/-/blob/v32/src/extension.ts
  disable() {
    this._dbus.flush();
    this._dbus.unexport();
    delete this._dbus;
  }

  _getWindow() {
    return global.display.get_focus_window();
  }

  _getMonitorIndex(window) {
    return global.display.get_monitor_index_for_rect(window.get_frame_rect());
  }

  _getMonitorScale(window) {
    return global.display.get_monitor_scale(this._getMonitorIndex(window));
  }

  _getMonitorGeometry(window) {
    return global.display.get_monitor_geometry(this._getMonitorIndex(window));
  }

  _getWorkArea(window) {
    return global.workspace_manager
      .get_active_workspace()
      .get_work_area_for_monitor(this._getMonitorIndex(window));
  }

  _scale(value, scale) {
    return Math.round(value * scale);
  }

  _unscale(value, scale) {
    return value / scale;
  }

  // https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/blob/gnome-46/extensions/screenshot-window-sizer/extension.js
  _notifySizeChange(window) {
    const scaleFactor = this._getMonitorScale(window);
    const frame = window.get_frame_rect();
    const monitor = this._getMonitorGeometry(window);
    const workArea = this._getWorkArea(window);

    let message = "";
    message += "Pos: (%d, %d)\n".format(
      this._unscale(frame.x, scaleFactor),
      this._unscale(frame.y, scaleFactor),
    );
    message += "Size: %dx%d\n".format(
      this._unscale(frame.width, scaleFactor),
      this._unscale(frame.height, scaleFactor),
    );
    message += "Monitor: %dx%d\n".format(
      this._unscale(monitor.width, scaleFactor),
      this._unscale(monitor.height, scaleFactor),
    );
    message += "WorkArea: %dx%d".format(
      this._unscale(workArea.width, scaleFactor),
      this._unscale(workArea.height, scaleFactor),
    );

    Main.notify(`${window.get_wm_class()} [${window.get_title()}]`, message);
  }

  _isWithinWorkArea(area, workArea) {
    return (
      area.x >= workArea.x &&
      area.y >= workArea.y &&
      area.x + area.width <= workArea.x + workArea.width &&
      area.y + area.height <= workArea.y + workArea.height
    );
  }

  _isEntireWorkAreaWidth(area, workArea) {
    return (
      this._isWithinWorkArea(area, workArea) &&
      area.x === workArea.x &&
      area.width === workArea.width
    );
  }

  _isEntireWorkAreaHeight(area, workArea) {
    return (
      this._isWithinWorkArea(area, workArea) &&
      area.y === workArea.y &&
      area.height === workArea.height
    );
  }

  Get() {
    const window = this._getWindow();
    if (!window) return;

    this._notifySizeChange(window);
  }

  Move(x, y) {
    const window = this._getWindow();
    if (!window) return;

    if (window.get_maximized()) {
      window.unmaximize(Meta.MaximizeFlags.BOTH);
    }

    window.move_frame(true, x, y);
  }

  MoveResize(x, y, width, height) {
    const window = this._getWindow();
    if (!window) return;

    const area = { x, y, width, height };
    const workArea = this._getWorkArea(window);

    // GNOME has its own built-in tiling that is activated when pressing
    // Super+Left/Right. There does not appear to be any way to detect this
    // through the Meta APIs, so we always unmaximize to break the tiling.
    if (window.get_maximized()) {
      window.unmaximize(Meta.MaximizeFlags.BOTH);
    }

    window.move_resize_frame(true, x, y, width, height);

    if (this._isEntireWorkAreaWidth(area, workArea)) {
      window.maximize(Meta.MaximizeFlags.HORIZONTAL);
    } else {
      window.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
    }

    if (this._isEntireWorkAreaHeight(area, workArea)) {
      window.maximize(Meta.MaximizeFlags.VERTICAL);
    } else {
      window.unmaximize(Meta.MaximizeFlags.VERTICAL);
    }

    // In some cases move_resize_frame() will only resize the window, and we
    // must call move_frame() to move it. This usually happens when the
    // window's minimum size is larger than the selected area. Movement can
    // also be a bit glitchy on Wayland. We therefore make extra attempts,
    // alternating between move_frame() and move_resize_frame().
    let attempts = 0;
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
      const frame = window.get_frame_rect();
      if (
        frame.x === x &&
        frame.y === y &&
        frame.width === width &&
        frame.height === height
      ) {
        return GLib.SOURCE_REMOVE;
      }

      if (attempts % 2 === 0) {
        window.move_frame(true, x, y);
      } else {
        window.move_resize_frame(true, x, y, width, height);
      }

      if (attempts++ >= 5) {
        return GLib.SOURCE_REMOVE;
      }

      return GLib.SOURCE_CONTINUE;
    });
  }

  Resize(width, height) {
    const window = this._getWindow();
    if (!window) return;

    const frame = window.get_frame_rect();
    const scaleFactor = this._getMonitorScale(window);

    this.MoveResize(
      frame.x,
      frame.y,
      this._scale(width, scaleFactor),
      this._scale(height, scaleFactor),
    );
  }

  MoveInMonitor(x, y) {
    const window = this._getWindow();
    if (!window) return;

    const monitor = this._getMonitorGeometry(window);
    const scaleFactor = this._getMonitorScale(window);

    this.Move(
      monitor.x + this._scale(x, scaleFactor),
      monitor.y + this._scale(y, scaleFactor),
    );
  }

  MoveResizeInMonitor(x, y, width, height) {
    const window = this._getWindow();
    if (!window) return;

    const monitor = this._getMonitorGeometry(window);
    const scaleFactor = this._getMonitorScale(window);

    this.MoveResize(
      monitor.x + this._scale(x, scaleFactor),
      monitor.y + this._scale(y, scaleFactor),
      this._scale(width, scaleFactor),
      this._scale(height, scaleFactor),
    );
  }

  MoveInWorkArea(x, y) {
    const window = this._getWindow();
    if (!window) return;

    const workArea = this._getWorkArea(window);
    const scaleFactor = this._getMonitorScale(window);

    this.Move(
      workArea.x + this._scale(x, scaleFactor),
      workArea.y + this._scale(y, scaleFactor),
    );
  }

  MoveResizeInWorkArea(x, y, width, height) {
    const window = this._getWindow();
    if (!window) return;

    const workArea = this._getWorkArea(window);
    const scaleFactor = this._getMonitorScale(window);

    this.MoveResize(
      workArea.x + this._scale(x, scaleFactor),
      workArea.y + this._scale(y, scaleFactor),
      this._scale(width, scaleFactor),
      this._scale(height, scaleFactor),
    );
  }

  CenterInWorkArea() {
    const window = this._getWindow();
    if (!window) return;

    const workArea = this._getWorkArea(window);
    const frame = window.get_frame_rect();

    const x = workArea.x + Math.floor((workArea.width - frame.width) / 2);
    const y = workArea.y + Math.floor((workArea.height - frame.height) / 2);

    this.Move(x, y);
  }
}
