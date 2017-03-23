<?php
/*
Template Name: Contatti
*/
get_header(); ?>

 <?php get_template_part( 'template-parts/featured-image' ); ?>
<?php while ( have_posts() ) : the_post(); ?>
<div id="contatti" role="main">
  <!--header>
      <h1 class="entry-title"><?php the_title(); ?></h1>
  </header -->
  <div class="info">
    <h4>Info contatti</h4>
    <ul class="contact">
      <li><p><i class="fi-marker"></i>Via Vitruvio, 11 20124 Milano</p></li>
      <li><p><i class="fi-telephone"></i>Tel: +39 02/89655729</p></li>
      <!--li><p><i class="fi-telephone"></i>Fax: +39 02/89655740</p></li-->
      <li><p><i class="fi-mail"></i><a href="mailto:info@artena.eu">info@artena.eu</a></p></li>
      <li><p><i class="fi-social-facebook"></i><a href="https://www.facebook.com/groups/752027778226882/" target="_blank">Seguci su Fb</a></p></li>
    </ul>
  </div>
  <div class="form-contatti">
    <?php the_content(); ?>
  </div>
</div>
  <?php endwhile;?>

<?php get_footer();
