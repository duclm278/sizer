all: install

install:
	mkdir -p ~/.local/share/gnome-shell/extensions/sizer@duclm278.github.io
	rsync -avz --exclude ".git*" ./ ~/.local/share/gnome-shell/extensions/sizer@duclm278.github.io
