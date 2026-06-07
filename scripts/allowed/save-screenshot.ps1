Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img) {
    $img.Save("C:\Projects\AuthentiQ\AI-ctx\runtime\screenshot.png", [System.Drawing.Imaging.ImageFormat]::Png)
} else {
    [System.Windows.Forms.MessageBox]::Show("Nincs kep a vagollapon.", "save-screenshot")
}
