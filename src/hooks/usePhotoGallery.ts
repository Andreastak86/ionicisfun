import { useState, useEffect } from "react";
import { isPlatform } from "@ionic/react";

import {
    Camera,
    CameraResultType,
    CameraSource,
    Photo,
} from "@capacitor/camera";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

export interface UserPhoto {
    filepath: string;
    webviewPath?: string;
}

export function usePhotoGallery() {
    const [photos, setPhotos] = useState<UserPhoto[]>([]);

    // Laste inn bilder ved oppstart
    useEffect(() => {
        const loadSaved = async () => {
            const { value } = await Preferences.get({ key: "photos" });
            const photosInPreferences = value ? JSON.parse(value) : [];

            if (!isPlatform("hybrid")) {
                // Last inn bilder for web
                for (let photo of photosInPreferences) {
                    const file = await Filesystem.readFile({
                        path: photo.filepath,
                        directory: Directory.Data,
                    });
                    photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
                }
            }
            setPhotos(photosInPreferences);
        };

        loadSaved();
    }, []);

    const savePicture = async (
        photo: Photo,
        fileName: string
    ): Promise<UserPhoto> => {
        let base64Data: string;
        // Sjekk om det er en hybrid plattform (iOS/Android)
        try {
            if (isPlatform("hybrid")) {
                // For hybrid plattformer
                const file = await Filesystem.readFile({
                    path: photo.path!,
                });
                base64Data = file.data as string;
            } else {
                // For web
                base64Data = await base64FromPath(photo.webPath!);
            }

            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Data,
            });

            // Lagre referanse til bildet i preferences
            const newPhotos = [
                {
                    filepath: fileName,
                    webviewPath: photo.webPath,
                },
                ...photos,
            ];

            await Preferences.set({
                key: "photos",
                value: JSON.stringify(newPhotos),
            });

            return {
                filepath: fileName,
                webviewPath: photo.webPath,
            };
        } catch (error) {
            console.error("Feil ved lagring av bilde:", error);
            throw error;
        }
    };

    const takePhoto = async () => {
        try {
            const photo = await Camera.getPhoto({
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
                quality: 100,
            });

            const fileName = Date.now() + ".jpeg";
            const savedFileImage = await savePicture(photo, fileName);

            setPhotos((current) => [savedFileImage, ...current]);
        } catch (error) {
            console.error("Kunne ikke ta bilde:", error);
        }
    };

    const deletePhoto = async (photo: UserPhoto) => {
        try {
            // Slett bildet fra filsystemet
            await Filesystem.deleteFile({
                path: photo.filepath,
                directory: Directory.Data,
            });

            // Oppdater listen over bilder
            const newPhotos = photos.filter(
                (p) => p.filepath !== photo.filepath
            );

            // Oppdater preferences
            await Preferences.set({
                key: "photos",
                value: JSON.stringify(newPhotos),
            });

            // Oppdater state
            setPhotos(newPhotos);
        } catch (error) {
            console.error("Kunne ikke slette bilde:", error);
        }
    };

    return {
        photos,
        takePhoto,
        deletePhoto,
    };
}

export async function base64FromPath(path: string): Promise<string> {
    try {
        const response = await fetch(path);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                if (typeof reader.result === "string") {
                    resolve(reader.result);
                } else {
                    reject("method did not return a string");
                }
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Feil ved konvertering til base64:", error);
        throw error;
    }
}
